import { describe, it, expect, beforeEach } from "vitest";
import {
  TenantLifecycleService,
  TenantExportEngine,
} from "../lib/tenancy";
import proxy from "../proxy";
import {
  POST as postExportRoute,
  GET as getExportRoute,
} from "../app/api/admin/tenants/export/route";
import {
  POST as postLifecycleRoute,
  GET as getLifecycleRoute,
} from "../app/api/admin/tenants/lifecycle/route";
import { NextRequest } from "next/server";

describe("Tenant Offboarding, Compliant Data Export & Retention Lifecycle (PRD §14.3 & §18.7)", () => {
  let lifecycleService: TenantLifecycleService;
  let exportEngine: TenantExportEngine;

  beforeEach(() => {
    lifecycleService = new TenantLifecycleService();
    exportEngine = new TenantExportEngine();
  });

  describe("1. Tenant Lifecycle State Machine & Quarantine", () => {
    it("initializes new tenants in ACTIVE state by default", () => {
      const state = lifecycleService.getState("tenant_alpha");
      expect(state.state).toBe("ACTIVE");
      expect(lifecycleService.isQuarantined("tenant_alpha")).toBe(false);
    });

    it("quarantines a tenant and records mandatory operator audit justification", () => {
      const record = lifecycleService.quarantine(
        "tenant_alpha",
        "Suspected security breach and credential leakage on lead account",
        "sec-ops-lead"
      );

      expect(record.state).toBe("QUARANTINED");
      expect(record.reason).toContain("security breach");
      expect(record.updatedBy).toBe("sec-ops-lead");
      expect(record.quarantinedAt).toBeDefined();
      expect(lifecycleService.isQuarantined("tenant_alpha")).toBe(true);
      expect(record.history.length).toBeGreaterThanOrEqual(2);
    });

    it("fails closed when attempting quarantine without mandatory audit justification", () => {
      expect(() => {
        lifecycleService.quarantine("tenant_alpha", "", "root-admin");
      }).toThrow(/justification reason is strictly mandatory/);
    });

    it("reinstates a quarantined tenant back to ACTIVE status", () => {
      lifecycleService.quarantine("tenant_alpha", "Pending audit", "root-admin");
      expect(lifecycleService.isQuarantined("tenant_alpha")).toBe(true);

      const reinstated = lifecycleService.reinstate(
        "tenant_alpha",
        "Security audit completed; credentials rotated",
        "root-admin"
      );

      expect(reinstated.state).toBe("ACTIVE");
      expect(lifecycleService.isQuarantined("tenant_alpha")).toBe(false);
    });
  });

  describe("2. Compliant Portable Data Export & Cryptographic Checksum (PRD §14.3)", () => {
    it("generates a complete multi-domain export bundle with valid SHA-256 manifest checksum", () => {
      const bundle = exportEngine.generateExportBundle("tenant_alpha", {
        tenantName: "Alpha Corp Enterprise",
        includeAuditTrail: true,
      });

      expect(bundle.manifest.exportId).toBeDefined();
      expect(bundle.manifest.tenantId).toBe("tenant_alpha");
      expect(bundle.manifest.tenantName).toBe("Alpha Corp Enterprise");
      expect(bundle.manifest.formatVersion).toBe("1.0.0");
      expect(bundle.manifest.checksumSha256).toBeDefined();
      expect(bundle.manifest.checksumSha256.length).toBe(64); // 64 hex characters (256 bits)

      // Verify entity counts match data payloads
      expect(bundle.manifest.entityCounts.users).toBe(bundle.data.users.length);
      expect(bundle.manifest.entityCounts.employees).toBe(bundle.data.employees.length);
      expect(bundle.manifest.entityCounts.teams).toBe(bundle.data.teams.length);
      expect(bundle.manifest.entityCounts.tickets).toBe(bundle.data.workManagement.tickets.length);
      expect(bundle.manifest.entityCounts.invoices).toBe(bundle.data.finance.invoices.length);

      // Verify SHA-256 integrity check
      const computedChecksum = TenantExportEngine.computeSha256(bundle.data);
      expect(bundle.manifest.checksumSha256).toBe(computedChecksum);
    });

    it("fails closed when tenantId is empty or invalid", () => {
      expect(() => {
        exportEngine.generateExportBundle("");
      }).toThrow(/tenantId must be non-empty/);
    });
  });

  describe("3. Strict Cross-Tenant Negative Isolation (PRD Binding Rule)", () => {
    it("cross-tenant negative gate: prevents Tenant B operator from retrieving Tenant A export bundle", () => {
      const bundle = exportEngine.generateExportBundle("tenant_alpha");

      // Tenant B operator attempts to download Tenant A export archive
      expect(() => {
        exportEngine.getExportBundle(bundle.manifest.exportId, "tenant_bravo");
      }).toThrow(/Cross-tenant authorization violation/);

      // Tenant Alpha operator can access successfully
      const retrieved = exportEngine.getExportBundle(bundle.manifest.exportId, "tenant_alpha");
      expect(retrieved.manifest.exportId).toBe(bundle.manifest.exportId);

      // Platform root-admin can access
      const rootRetrieved = exportEngine.getExportBundle(bundle.manifest.exportId, "*");
      expect(rootRetrieved.manifest.exportId).toBe(bundle.manifest.exportId);
    });
  });

  describe("4. Cryptographic Shredding & Data Retention Lifecycle", () => {
    it("purges all tenant data and returns an immutable signed PurgeReceipt", () => {
      const bundle = exportEngine.generateExportBundle("tenant_to_delete");

      const receipt = exportEngine.executePurge(
        "tenant_to_delete",
        "compliance-officer",
        "GDPR Article 17 Right to Erasure Request"
      );

      expect(receipt.receiptId).toBeDefined();
      expect(receipt.tenantId).toBe("tenant_to_delete");
      expect(receipt.purgedAt).toBeDefined();
      expect(receipt.operatorId).toBe("compliance-officer");
      expect(receipt.reason).toContain("GDPR");
      expect(receipt.recordsShreddedCount).toBeGreaterThan(0);
      expect(receipt.cryptographicSignature.length).toBe(64);

      // Verify export archive is no longer accessible
      expect(() => {
        exportEngine.getExportBundle(bundle.manifest.exportId, "tenant_to_delete");
      }).toThrow(/not found or already purged/);
    });
  });

  describe("5. Edge Proxy Quarantine Enforcement", () => {
    it("blocks incoming API requests for quarantined tenants with HTTP 403 TENANT_QUARANTINED", async () => {
      const { globalTenantLifecycleService } = await import("../lib/tenancy");
      globalTenantLifecycleService.quarantine("tenant_quarantine_test", "Policy violation", "admin");

      const req = new NextRequest("http://localhost:3000/api/tickets", {
        headers: {
          "x-tenant-id": "tenant_quarantine_test",
        },
      });

      const res = proxy(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("TENANT_QUARANTINED");
      expect(res.headers.get("X-Tenant-Status")).toBe("QUARANTINED");

      // Reinstate and verify traffic flows through
      globalTenantLifecycleService.reinstate("tenant_quarantine_test", "Resolved", "admin");
      const unblockedReq = new NextRequest("http://localhost:3000/api/tickets", {
        headers: {
          "x-tenant-id": "tenant_quarantine_test",
        },
      });
      const unblockedRes = proxy(unblockedReq);
      expect(unblockedRes.status).not.toBe(403);
    });
  });

  describe("6. REST API Route Integration", () => {
    it("generates export bundle via POST and downloads with checksum headers via GET", async () => {
      const postReq = new NextRequest("http://localhost:3000/api/admin/tenants/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "tenant_api_export",
        },
        body: JSON.stringify({
          tenantName: "Export API Test Corp",
        }),
      });

      const postRes = await postExportRoute(postReq);
      expect(postRes.status).toBe(200);
      const postData = await postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.exportId).toBeDefined();

      const getReq = new NextRequest(
        `http://localhost:3000/api/admin/tenants/export?exportId=${postData.exportId}`,
        {
          headers: {
            "x-tenant-id": "tenant_api_export",
          },
        }
      );

      const getRes = await getExportRoute(getReq);
      expect(getRes.status).toBe(200);
      expect(getRes.headers.get("Content-Disposition")).toContain("attachment");
      expect(getRes.headers.get("X-Checksum-SHA256")).toBeDefined();
    });

    it("manages quarantine and reinstatement via POST /api/admin/tenants/lifecycle", async () => {
      const quarantineReq = new NextRequest("http://localhost:3000/api/admin/tenants/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quarantine",
          tenantId: "tenant_api_lifecycle",
          reason: "Payment delinquency over 90 days",
          operatorId: "finance-admin",
        }),
      });

      const qRes = await postLifecycleRoute(quarantineReq);
      expect(qRes.status).toBe(200);
      const qData = await qRes.json();
      expect(qData.record.state).toBe("QUARANTINED");

      // Verify GET lifecycle reports quarantined
      const getReq = new NextRequest(
        "http://localhost:3000/api/admin/tenants/lifecycle?tenantId=tenant_api_lifecycle"
      );
      const getRes = await getLifecycleRoute(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.isQuarantined).toBe(true);

      // Reinstate
      const reinstateReq = new NextRequest("http://localhost:3000/api/admin/tenants/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reinstate",
          tenantId: "tenant_api_lifecycle",
          reason: "Payment received and reconciled",
          operatorId: "finance-admin",
        }),
      });

      const rRes = await postLifecycleRoute(reinstateReq);
      expect(rRes.status).toBe(200);
      const rData = await rRes.json();
      expect(rData.record.state).toBe("ACTIVE");
    });
  });
});
