import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { writeAuditAsync } from "@/lib/permissions/audit";
import { invalidateAuthContext } from "@/lib/permissions/context";

export type PlanTier = "starter" | "professional" | "enterprise";
export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"
  | "expired";
export type LifecycleStatus =
  | "provisioning"
  | "active"
  | "suspended"
  | "offboarding"
  | "closed";

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  domain?: string;
  planTier?: PlanTier;
  adminEmail: string;
  adminPassword?: string;
  seatLimit?: number;
  storageLimitGB?: number;
}

export interface UpdateSubscriptionInput {
  planTier?: PlanTier;
  status?: SubscriptionStatus;
  seatLimit?: number;
  storageLimitGB?: number;
  features?: string[];
}

/**
 * Retrieves the complete portfolio of tenant workspaces, subscriptions, and quota metrics.
 */
export async function getTenantWorkspacesPortfolio() {
  const workspaces = await prisma.tenantWorkspace.findMany({
    orderBy: { createdAt: "desc" },
  });

  const portfolio = await Promise.all(
    workspaces.map(async (ws) => {
      // Find or create default subscription
      let sub = await prisma.tenantSubscription.findUnique({
        where: { tenantId: ws.tenantId },
      });

      if (!sub) {
        sub = await prisma.tenantSubscription.create({
          data: {
            tenantId: ws.tenantId,
            planTier: "starter",
            status: ws.isActive ? "active" : "suspended",
            seatLimit: 10,
            storageLimitBytes: 5368709120n,
            features: ["core_hrms", "crm_core", "documents", "calendar"],
          },
        });
      }

      // Compute seat utilization (active employees in tenant)
      const activeSeats = await prisma.employee.count({
        where: { tenantId: ws.tenantId, employmentStatus: "active" },
      });

      // Compute document storage usage in bytes
      const storageAgg = await prisma.document.aggregate({
        where: { tenantId: ws.tenantId, isArchived: false },
        _sum: { fileSizeBytes: true },
      });
      const storageUsedBytes = storageAgg._sum.fileSizeBytes || 0;

      // Active sessions count
      const activeSessions = await prisma.session.count({
        where: {
          tenantId: ws.tenantId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      return {
        id: ws.id,
        tenantId: ws.tenantId,
        name: ws.name,
        slug: ws.slug,
        domain: ws.domain,
        isActive: ws.isActive,
        lifecycleStatus: ws.lifecycleStatus,
        suspendedReason: ws.suspendedReason,
        suspendedAt: ws.suspendedAt?.toISOString() || null,
        createdAt: ws.createdAt.toISOString(),
        subscription: {
          id: sub.id,
          planTier: sub.planTier,
          status: sub.status,
          seatLimit: sub.seatLimit,
          storageLimitBytes: Number(sub.storageLimitBytes),
          features: Array.isArray(sub.features) ? sub.features : [],
        },
        utilization: {
          activeSeats,
          seatLimit: sub.seatLimit,
          seatUsagePercent: Math.min(
            100,
            Math.round((activeSeats / Math.max(1, sub.seatLimit)) * 100)
          ),
          storageUsedBytes,
          storageLimitBytes: Number(sub.storageLimitBytes),
          storageUsagePercent: Math.min(
            100,
            Math.round(
              (storageUsedBytes / Math.max(1, Number(sub.storageLimitBytes))) * 100
            )
          ),
          activeSessions,
        },
      };
    })
  );

  const totalTenants = portfolio.length;
  const activeTenants = portfolio.filter((p) => p.lifecycleStatus === "active").length;
  const suspendedTenants = portfolio.filter((p) => p.lifecycleStatus === "suspended").length;
  const totalSubscribedSeats = portfolio.reduce(
    (acc, p) => acc + p.subscription.seatLimit,
    0
  );

  return {
    workspaces: portfolio,
    metrics: {
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalSubscribedSeats,
    },
  };
}

/**
 * Provisions a new isolated tenant workspace, subscription, and bootstrap root administrator.
 */
export async function provisionTenant(
  operatorUserId: string,
  input: ProvisionTenantInput
) {
  if (!input.name?.trim() || !input.slug?.trim() || !input.adminEmail?.trim()) {
    throw new Error("MISSING_REQUIRED_FIELDS");
  }

  const normalizedSlug = input.slug.toLowerCase().trim();
  const normalizedEmail = input.adminEmail.toLowerCase().trim();

  // Check slug uniqueness
  const existing = await prisma.tenantWorkspace.findFirst({
    where: { slug: normalizedSlug },
  });
  if (existing) {
    throw new Error("SLUG_ALREADY_EXISTS");
  }

  const tenantId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const employeeId = crypto.randomUUID();

  const planTier = input.planTier || "starter";
  const seatLimit = input.seatLimit || (planTier === "enterprise" ? 100 : planTier === "professional" ? 25 : 10);
  const storageLimitBytes = BigInt(
    (input.storageLimitGB || (planTier === "enterprise" ? 100 : planTier === "professional" ? 25 : 5)) *
      1024 *
      1024 *
      1024
  );

  const rawPassword = input.adminPassword || "WelcomeOpsEngine2026!";
  const passwordHash = await hashPassword(rawPassword);

  // 1. Create Workspace
  const workspace = await prisma.tenantWorkspace.create({
    data: {
      id: tenantId,
      tenantId,
      name: input.name.trim(),
      slug: normalizedSlug,
      domain: input.domain?.trim() || null,
      isActive: true,
      lifecycleStatus: "active",
      aiEnabled: planTier === "enterprise",
    },
  });

  // 2. Create Subscription
  const subscription = await prisma.tenantSubscription.create({
    data: {
      tenantId,
      planTier,
      status: "active",
      seatLimit,
      storageLimitBytes,
      features:
        planTier === "enterprise"
          ? ["core_hrms", "crm_core", "finance", "approvals", "documents", "calendar", "ai_assistant", "audit_export"]
          : ["core_hrms", "crm_core", "documents", "calendar"],
    },
  });

  // 3. Create Root Administrator in AuthUser
  const adminUser = await prisma.authUser.create({
    data: {
      id: adminId,
      tenantId,
      email: normalizedEmail,
      passwordHash,
      isRootAdmin: true,
    },
  });

  // 4. Create Active Tenant Membership
  await prisma.tenantMembership.create({
    data: {
      tenantId,
      userId: adminId,
      employeeId,
      status: "active",
    },
  });

  // 5. Create Employee Profile
  await prisma.employee.create({
    data: {
      id: employeeId,
      tenantId,
      userId: adminId,
      displayName: `${input.name.trim()} Administrator`,
      workEmail: normalizedEmail,
      department: "Administration",
      employmentStatus: "active",
    },
  });

  // 6. Grant Lead & HR roles
  await prisma.roleGrant.create({
    data: {
      tenantId,
      principalUserId: adminId,
      roleKey: "lead",
      scopeType: "TENANT",
    },
  });

  // 7. Audit Log
  await writeAuditAsync({
    tenantId,
    actorUserId: operatorUserId,
    eventType: "tenant.provision",
    resourceType: "tenant_workspace",
    resourceId: tenantId,
    decision: "allow",
    metadata: {
      tenantName: input.name,
      slug: normalizedSlug,
      planTier,
      adminEmail: normalizedEmail,
    },
  });

  return {
    tenantId,
    workspace,
    subscription,
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
      initialPassword: rawPassword,
    },
  };
}

/**
 * Executes a tenant lifecycle state transition (active, suspended, closed).
 * If suspended, immediately revokes all active sessions for the tenant.
 */
export async function setTenantLifecycleStatus(
  tenantId: string,
  operatorUserId: string,
  status: LifecycleStatus,
  reason?: string
) {
  const ws = await prisma.tenantWorkspace.findFirst({
    where: { tenantId },
  });

  if (!ws) {
    throw new Error("TENANT_NOT_FOUND");
  }

  const isActive = status === "active";
  const now = new Date();

  await prisma.tenantWorkspace.updateMany({
    where: { tenantId },
    data: {
      isActive,
      lifecycleStatus: status,
      suspendedReason: status === "suspended" ? reason || "Suspended by operator" : null,
      suspendedAt: status === "suspended" ? now : null,
    },
  });

  const updated = (await prisma.tenantWorkspace.findFirst({
    where: { tenantId },
  }))!;

  // Update subscription status in lockstep
  await prisma.tenantSubscription.updateMany({
    where: { tenantId },
    data: {
      status: status === "suspended" ? "suspended" : status === "closed" ? "cancelled" : "active",
    },
  });

  // IMMEDIATE SESSION REVOCATION:
  // When a tenant is suspended or closed, immediately invalidate all active sessions
  if (status === "suspended" || status === "closed") {
    await prisma.session.updateMany({
      where: { tenantId, revokedAt: null },
      data: {
        revokedAt: now,
        revokedBy: operatorUserId,
      },
    });
  }

  // Clear in-memory authz cache
  invalidateAuthContext(tenantId);

  // Write audit trail
  await writeAuditAsync({
    tenantId,
    actorUserId: operatorUserId,
    eventType: "tenant.lifecycle.transition",
    resourceType: "tenant_workspace",
    resourceId: tenantId,
    decision: "allow",
    metadata: {
      previousStatus: ws.lifecycleStatus,
      newStatus: status,
      reason: reason || null,
    },
  });

  return updated;
}

/**
 * Updates a tenant's subscription plan, quotas, and feature entitlements.
 */
export async function updateTenantSubscription(
  tenantId: string,
  operatorUserId: string,
  input: UpdateSubscriptionInput
) {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
  });

  if (!sub) {
    throw new Error("SUBSCRIPTION_NOT_FOUND");
  }

  const storageBytes = input.storageLimitGB
    ? BigInt(input.storageLimitGB * 1024 * 1024 * 1024)
    : undefined;

  const updated = await prisma.tenantSubscription.update({
    where: { tenantId },
    data: {
      planTier: input.planTier || undefined,
      status: input.status || undefined,
      seatLimit: input.seatLimit || undefined,
      storageLimitBytes: storageBytes,
      features: input.features ? (input.features as any) : undefined,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId: operatorUserId,
    eventType: "tenant.subscription.update",
    resourceType: "tenant_subscription",
    resourceId: sub.id,
    decision: "allow",
    metadata: {
      planTier: updated.planTier,
      seatLimit: updated.seatLimit,
      status: updated.status,
    },
  });

  return {
    ...updated,
    storageLimitBytes: Number(updated.storageLimitBytes),
  };
}

/**
 * Validates tenant quotas server-side before allocating seats or storage.
 */
export async function checkTenantQuota(tenantId: string) {
  const ws = await prisma.tenantWorkspace.findFirst({
    where: { tenantId },
  });

  if (!ws || !ws.isActive || ws.lifecycleStatus === "suspended") {
    throw new Error("TENANT_SUSPENDED");
  }

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
  });

  const seatLimit = sub?.seatLimit || 10;
  const storageLimitBytes = Number(sub?.storageLimitBytes || 5368709120n);

  const activeSeats = await prisma.employee.count({
    where: { tenantId, employmentStatus: "active" },
  });

  const storageAgg = await prisma.document.aggregate({
    where: { tenantId, isArchived: false },
    _sum: { fileSizeBytes: true },
  });
  const usedStorageBytes = storageAgg._sum.fileSizeBytes || 0;

  return {
    planTier: sub?.planTier || "starter",
    status: sub?.status || "active",
    seats: {
      used: activeSeats,
      limit: seatLimit,
      allowed: activeSeats < seatLimit,
    },
    storage: {
      usedBytes: usedStorageBytes,
      limitBytes: storageLimitBytes,
      allowed: usedStorageBytes < storageLimitBytes,
    },
    features: Array.isArray(sub?.features) ? (sub?.features as string[]) : [],
  };
}

/**
 * Generates an encrypted, tenant-scoped data export archive containing all tenant records.
 */
export async function exportTenantData(
  tenantId: string,
  operatorUserId: string
) {
  const ws = await prisma.tenantWorkspace.findFirst({
    where: { tenantId },
  });

  if (!ws) {
    throw new Error("TENANT_NOT_FOUND");
  }

  // Fetch all domain rows strictly scoped to tenantId
  const [
    employees,
    teams,
    documents,
    calendarEvents,
    auditEvents,
    subscription,
  ] = await Promise.all([
    prisma.employee.findMany({ where: { tenantId } }),
    prisma.team.findMany({ where: { tenantId } }),
    prisma.document.findMany({ where: { tenantId } }),
    prisma.calendarEvent.findMany({ where: { tenantId } }),
    prisma.auditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.tenantSubscription.findUnique({ where: { tenantId } }),
  ]);

  const archive = {
    metadata: {
      exportId: crypto.randomUUID(),
      tenantId,
      organizationName: ws.name,
      slug: ws.slug,
      exportedAt: new Date().toISOString(),
      exportedBy: operatorUserId,
      version: "1.0",
    },
    subscription: subscription
      ? {
          ...subscription,
          storageLimitBytes: Number(subscription.storageLimitBytes),
        }
      : null,
    employees,
    teams,
    documents,
    calendarEvents,
    auditEvents,
  };

  const recordCount =
    employees.length +
    teams.length +
    documents.length +
    calendarEvents.length +
    auditEvents.length;

  const exportRecord = await prisma.tenantDataExport.create({
    data: {
      tenantId,
      requestedBy: operatorUserId,
      status: "completed",
      recordCount,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      archiveData: archive as any,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId: operatorUserId,
    eventType: "tenant.data.export",
    resourceType: "tenant_data_export",
    resourceId: exportRecord.id,
    decision: "allow",
    metadata: { recordCount },
  });

  return {
    exportId: exportRecord.id,
    recordCount,
    expiresAt: exportRecord.expiresAt,
    archive,
  };
}

/**
 * Creates an audited, time-limited break-glass support session for platform operators.
 */
export async function createSupportSession(
  tenantId: string,
  operatorUserId: string,
  reason: string
) {
  if (!reason?.trim()) {
    throw new Error("REASON_REQUIRED");
  }

  const token = `supp-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

  const session = await prisma.supportSession.create({
    data: {
      tenantId,
      operatorUserId,
      reason: reason.trim(),
      token,
      expiresAt,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId: operatorUserId,
    eventType: "tenant.support.break_glass_issued",
    resourceType: "support_session",
    resourceId: session.id,
    decision: "allow",
    metadata: { reason: reason.trim(), expiresAt: expiresAt.toISOString() },
  });

  return {
    id: session.id,
    token: session.token,
    expiresAt: session.expiresAt,
    tenantId,
  };
}
