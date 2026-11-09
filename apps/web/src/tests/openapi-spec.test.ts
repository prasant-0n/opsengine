import { describe, it, expect } from "vitest";
import { generateOpenApiSpec } from "@opsengine/api-contracts";
import { GET as getOpenApiJson } from "../app/api/openapi.json/route";
import { GET as getDocsHtml } from "../app/api/docs/route";

describe("OpenAPI 3.1 Contract Generation & Documentation Engine (PRD §7.3 & §10)", () => {
  describe("1. Specification Structure & Completeness", () => {
    const spec = generateOpenApiSpec();

    it("conforms to OpenAPI 3.1.0 specification standard", () => {
      expect(spec.openapi).toBe("3.1.0");
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toContain("OpsEngine");
      expect(spec.info.version).toBe("1.0.0");
      expect(spec.servers.length).toBeGreaterThanOrEqual(2);
    });

    it("covers all 16 operational bounded context domains", () => {
      const expectedDomains = [
        "Authentication",
        "Identity & ReBAC",
        "SaaS Control Plane",
        "Organization & HRMS",
        "Recruitment & ATS",
        "Onboarding & Induction",
        "Time & Attendance",
        "Work & Projects",
        "CRM & Sales",
        "Finance & Invoicing",
        "Approval Workflows",
        "Documents & Storage",
        "Calendar & Meetings",
        "Telemetry & Health",
        "Auditing & Reports",
        "AI Assistant",
      ];

      const registeredTagNames = spec.tags.map((t) => t.name);
      for (const domain of expectedDomains) {
        expect(registeredTagNames).toContain(domain);
      }
    });

    it("defines essential security schemes including ReBAC cookie and tenant header", () => {
      const schemes = spec.components.securitySchemes;
      expect(schemes.SessionCookie).toBeDefined();
      expect(schemes.SessionCookie.type).toBe("apiKey");
      expect(schemes.SessionCookie.name).toBe("ops_session");

      expect(schemes.BearerAuth).toBeDefined();
      expect(schemes.BearerAuth.type).toBe("http");
      expect(schemes.BearerAuth.scheme).toBe("bearer");

      expect(schemes.TenantContext).toBeDefined();
      expect(schemes.TenantContext.name).toBe("x-tenant-id");
    });

    it("contains comprehensive data component schemas", () => {
      const schemas = spec.components.schemas;
      expect(schemas.ErrorResponse).toBeDefined();
      expect(schemas.LoginRequest).toBeDefined();
      expect(schemas.LoginResponse).toBeDefined();
      expect(schemas.WhoAmIResponse).toBeDefined();
      expect(schemas.TenantWorkspace).toBeDefined();
      expect(schemas.Employee).toBeDefined();
      expect(schemas.Ticket).toBeDefined();
      expect(schemas.Project).toBeDefined();
      expect(schemas.Invoice).toBeDefined();
      expect(schemas.LeaveRequest).toBeDefined();
      expect(schemas.HealthStatus).toBeDefined();
      expect(schemas.AuditEvent).toBeDefined();
    });

    it("documents paths across all core domains with standard HTTP responses", () => {
      const pathKeys = Object.keys(spec.paths);
      expect(pathKeys.length).toBeGreaterThanOrEqual(20);

      // Verify specific representative routes
      expect(spec.paths["/api/auth/login"]?.post).toBeDefined();
      expect(spec.paths["/api/authz/whoami"]?.get).toBeDefined();
      expect(spec.paths["/api/control-plane/workspaces"]?.get).toBeDefined();
      expect(spec.paths["/api/org/employees"]?.get).toBeDefined();
      expect(spec.paths["/api/tickets"]?.get).toBeDefined();
      expect(spec.paths["/api/finance/invoices"]?.get).toBeDefined();
      expect(spec.paths["/api/health"]?.get).toBeDefined();
      expect(spec.paths["/api/metrics"]?.get).toBeDefined();
      expect(spec.paths["/api/assistant/chat"]?.post).toBeDefined();
    });
  });

  describe("2. HTTP Route Handlers", () => {
    it("serves raw OpenAPI 3.1 specification at /api/openapi.json", async () => {
      const response = await getOpenApiJson();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");

      const body = await response.json();
      expect(body.openapi).toBe("3.1.0");
      expect(body.info.title).toContain("OpsEngine");
      expect(body.paths["/api/auth/login"]).toBeDefined();
    });

    it("serves self-hosted interactive documentation explorer at /api/docs", async () => {
      const response = await getDocsHtml();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");

      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("OpsEngine API Documentation");
      expect(html).toContain("OpenAPI 3.1.0");
      expect(html).toContain("endpointsContainer");
      expect(html).toContain("/api/openapi.json");
    });
  });
});
