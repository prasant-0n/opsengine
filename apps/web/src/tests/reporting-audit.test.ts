import { describe, it, expect } from "vitest";
import { prisma } from "../lib/prisma";
import {
  getExecutiveSummary,
  getAuditEvents,
  getStageHistory,
  exportAuditEventsCsv,
} from "../features/reporting/lib/reporting-service";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const USER_A = "00000000-0000-4000-8000-000000000001";

describe("Module 16 — Executive Reporting, Analytics & Audit Engine", () => {
  it("aggregates an executive summary across workforce, delivery, CRM, and finance", async () => {
    const summary = await getExecutiveSummary(TENANT_A);

    expect(summary).toBeDefined();
    // Workforce
    expect(summary.workforce).toBeDefined();
    expect(typeof summary.workforce.totalEmployees).toBe("number");
    expect(typeof summary.workforce.attendanceRatePct).toBe("number");

    // Delivery
    expect(summary.delivery).toBeDefined();
    expect(typeof summary.delivery.activeProjects).toBe("number");
    expect(typeof summary.delivery.openTickets).toBe("number");

    // Sales & Finance
    expect(summary.sales).toBeDefined();
    expect(typeof summary.sales.totalPipelineCents).toBe("number");
    expect(summary.finance).toBeDefined();
    expect(typeof summary.finance.totalBilledCents).toBe("number");

    // Governance
    expect(summary.governance).toBeDefined();
    expect(summary.governance.totalAuditEvents).toBeGreaterThanOrEqual(0);
  });

  it("queries and filters audit events strictly scoped to tenant", async () => {
    // Insert an audit event for test
    await prisma.auditEvent.create({
      data: {
        tenantId: TENANT_A,
        actorUserId: USER_A,
        eventType: "TEST_SECURITY_EVENT",
        decision: "allow",
        reasonCode: "TEST_VERIFICATION",
      },
    });

    const result = await getAuditEvents(TENANT_A, { eventType: "TEST_SECURITY_EVENT" });
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    expect(result.events.every((e) => e.tenantId === TENANT_A)).toBe(true);
    expect(result.events[0].eventType).toBe("TEST_SECURITY_EVENT");
  });

  it("queries stage history across lifecycle entities", async () => {
    const result = await getStageHistory(TENANT_A);
    expect(result).toBeDefined();
    expect(result.history.every((h) => h.tenantId === TENANT_A)).toBe(true);
  });

  it("generates structured CSV export of audit events", async () => {
    const csv = await exportAuditEventsCsv(TENANT_A, { limit: 10 });
    expect(csv).toContain("Timestamp,Event Type,Decision,Reason Code,Resource Type,Actor User ID");
    expect(csv.split("\n").length).toBeGreaterThan(1);
  });

  it("cross-tenant negative test: Tenant B queries return zero Tenant A audit events", async () => {
    const resultB = await getAuditEvents(TENANT_B, { eventType: "TEST_SECURITY_EVENT" });
    expect(resultB.events.length).toBe(0);
  });
});
