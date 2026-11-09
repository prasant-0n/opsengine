import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/prisma";
import {
  getTenantWorkspacesPortfolio,
  provisionTenant,
  setTenantLifecycleStatus,
  updateTenantSubscription,
  checkTenantQuota,
  exportTenantData,
  createSupportSession,
} from "../features/control-plane/lib/control-plane-service";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const OPERATOR_USER = "00000000-0000-4000-8000-000000000001"; // USER_A (superadmin)

describe("Module 0A — SaaS Control Plane, Tenant Lifecycle, Plans & Entitlements", () => {
  it("retrieves the workspace portfolio, active subscriptions, and quota metrics", async () => {
    const portfolio = await getTenantWorkspacesPortfolio();

    expect(portfolio).toBeDefined();
    expect(portfolio.workspaces.length).toBeGreaterThanOrEqual(2);

    const wsA = portfolio.workspaces.find((w) => w.tenantId === TENANT_A);
    expect(wsA).toBeDefined();
    expect(wsA?.name).toBe("Acme Corp");
    expect(wsA?.subscription.planTier).toBe("enterprise");
    expect(wsA?.subscription.seatLimit).toBeGreaterThanOrEqual(100);
    expect(wsA?.utilization.activeSeats).toBeGreaterThanOrEqual(1);

    expect(portfolio.metrics.totalTenants).toBeGreaterThanOrEqual(2);
    expect(portfolio.metrics.totalSubscribedSeats).toBeGreaterThanOrEqual(125);
  });

  it("provisions a new isolated tenant with subscription, admin account, and employee profile", async () => {
    const testSlug = `test-org-${Date.now()}`;
    const result = await provisionTenant(OPERATOR_USER, {
      name: "Stark Industries",
      slug: testSlug,
      domain: `${testSlug}.opsengine.io`,
      planTier: "professional",
      adminEmail: `admin@${testSlug}.opsengine.io`,
      adminPassword: "Password123!",
      seatLimit: 25,
      storageLimitGB: 50,
    });

    expect(result).toBeDefined();
    expect(result.tenantId).toBeDefined();
    expect(result.workspace.name).toBe("Stark Industries");
    expect(result.workspace.slug).toBe(testSlug);
    expect(result.subscription.planTier).toBe("professional");
    expect(result.subscription.seatLimit).toBe(25);
    expect(result.adminUser.email).toBe(`admin@${testSlug}.opsengine.io`);

    // Verify root admin created in DB
    const adminUser = await prisma.authUser.findUnique({
      where: { id: result.adminUser.id },
    });
    expect(adminUser).toBeDefined();
    expect(adminUser?.isRootAdmin).toBe(true);

    // Verify employee profile created
    const employee = await prisma.employee.findFirst({
      where: { tenantId: result.tenantId },
    });
    expect(employee).toBeDefined();
    expect(employee?.workEmail).toBe(`admin@${testSlug}.opsengine.io`);

    // Verify audit log
    const audit = await prisma.auditEvent.findFirst({
      where: {
        tenantId: result.tenantId,
        eventType: "tenant.provision",
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorUserId).toBe(OPERATOR_USER);

    // Verify duplicate slug rejection
    await expect(
      provisionTenant(OPERATOR_USER, {
        name: "Duplicate Org",
        slug: testSlug,
        adminEmail: "other@org.com",
      })
    ).rejects.toThrow("SLUG_ALREADY_EXISTS");
  });

  it("suspends a tenant and verifies immediate session revocation, then reactivates", async () => {
    // 1. Create a dummy session for Tenant A
    const testSessionToken = `test-session-${Date.now()}`;
    const session = await prisma.session.create({
      data: {
        tenantId: TENANT_A,
        userId: OPERATOR_USER,
        token: testSessionToken,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    expect(session.revokedAt).toBeNull();

    // 2. Suspend Tenant A
    const suspended = await setTenantLifecycleStatus(
      TENANT_A,
      OPERATOR_USER,
      "suspended",
      "Billing delinquent / payment failure"
    );

    expect(suspended.isActive).toBe(false);
    expect(suspended.lifecycleStatus).toBe("suspended");
    expect(suspended.suspendedReason).toContain("Billing delinquent");

    // 3. IMMEDIATE SESSION REVOCATION: verify the active session is revoked
    const revokedSession = await prisma.session.findUnique({
      where: { token: testSessionToken },
    });
    expect(revokedSession?.revokedAt).not.toBeNull();
    expect(revokedSession?.revokedBy).toBe(OPERATOR_USER);

    // 4. checkTenantQuota rejects requests for suspended tenant
    await expect(checkTenantQuota(TENANT_A)).rejects.toThrow("TENANT_SUSPENDED");

    // 5. Reactivate Tenant A
    const reactivated = await setTenantLifecycleStatus(
      TENANT_A,
      OPERATOR_USER,
      "active"
    );
    expect(reactivated.isActive).toBe(true);
    expect(reactivated.lifecycleStatus).toBe("active");
    expect(reactivated.suspendedReason).toBeNull();

    // Clean up test session
    await prisma.session.delete({ where: { token: testSessionToken } });
  });

  it("updates tenant subscription plans and verifies server-side quota checks", async () => {
    const updated = await updateTenantSubscription(TENANT_A, OPERATOR_USER, {
      planTier: "enterprise",
      seatLimit: 150,
      storageLimitGB: 200,
    });

    expect(updated.planTier).toBe("enterprise");
    expect(updated.seatLimit).toBe(150);

    const quota = await checkTenantQuota(TENANT_A);
    expect(quota.planTier).toBe("enterprise");
    expect(quota.seats.limit).toBe(150);
    expect(quota.seats.allowed).toBe(true);
    expect(quota.storage.allowed).toBe(true);
  });

  it("exports a tenant data archive and asserts strict tenant-only scoping", async () => {
    const exportResult = await exportTenantData(TENANT_A, OPERATOR_USER);

    expect(exportResult).toBeDefined();
    expect(exportResult.exportId).toBeDefined();
    expect(exportResult.recordCount).toBeGreaterThan(0);
    expect(exportResult.archive.metadata.tenantId).toBe(TENANT_A);

    // Verify negative isolation in export: no records belonging to Tenant B exist in Tenant A archive
    const archive = exportResult.archive;
    expect(archive.employees.every((e: any) => e.tenantId === TENANT_A)).toBe(true);
    expect(archive.teams.every((t: any) => t.tenantId === TENANT_A)).toBe(true);
    expect(archive.documents.every((d: any) => d.tenantId === TENANT_A)).toBe(true);

    // Verify audit log recorded
    const audit = await prisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A,
        eventType: "tenant.data.export",
        resourceId: exportResult.exportId,
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorUserId).toBe(OPERATOR_USER);
  });

  it("creates an audited, time-limited break-glass support session", async () => {
    const support = await createSupportSession(
      TENANT_A,
      OPERATOR_USER,
      "Investigating client-reported authentication outage under ticket #SUPP-101"
    );

    expect(support).toBeDefined();
    expect(support.token.startsWith("supp-")).toBe(true);
    expect(support.tenantId).toBe(TENANT_A);
    expect(new Date(support.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Verify audit log recorded
    const audit = await prisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A,
        eventType: "tenant.support.break_glass_issued",
        resourceId: support.id,
      },
    });
    expect(audit).toBeDefined();
    expect((audit?.metadata as any)?.reason).toContain("SUPP-101");

    // Clean up support session
    await prisma.supportSession.delete({ where: { id: support.id } });
  });
});
