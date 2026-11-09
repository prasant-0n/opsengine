import { prisma } from "@/lib/prisma";

export interface AuditEventFilter {
  eventType?: string;
  decision?: string;
  actorUserId?: string;
  limit?: number;
  offset?: number;
}

export interface StageHistoryFilter {
  entityType?: string;
  limit?: number;
  offset?: number;
}

export async function getExecutiveSummary(tenantId: string) {
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

  const [
    totalEmployees,
    departments,
    todayAttended,
    todayOnLeave,
    activeProjects,
    openTickets,
    resolvedTickets,
    opportunities,
    openLeads,
    invoices,
    unpaidReceivables,
    openRequisitions,
    activeOnboarding,
    pendingApprovals,
    totalAuditEvents,
  ] = await Promise.all([
    // Workforce
    prisma.employee.count({
      where: { tenantId, employmentStatus: "active" },
    }),
    prisma.employee.groupBy({
      by: ["department"],
      where: { tenantId, employmentStatus: "active" },
      _count: { id: true },
    }),
    prisma.attendanceDay.count({
      where: {
        tenantId,
        workDate: today,
        status: { in: ["checked_in", "checked_out"] },
      },
    }),
    prisma.attendanceDay.count({
      where: {
        tenantId,
        workDate: today,
        status: "leave",
      },
    }),
    // Projects & Tickets
    prisma.project.count({
      where: { tenantId, status: "active" },
    }),
    prisma.ticket.count({
      where: { tenantId, status: { in: ["open", "in_progress", "in_review", "triaged"] } },
    }),
    prisma.ticket.count({
      where: { tenantId, status: { in: ["resolved", "closed"] } },
    }),
    // CRM
    prisma.crmOpportunity.findMany({
      where: { tenantId },
      select: { amountCents: true, stage: true },
    }),
    prisma.crmLead.count({
      where: { tenantId, status: { not: "converted" } },
    }),
    // Finance
    prisma.invoice.findMany({
      where: { tenantId },
      select: { totalCents: true, status: true },
    }),
    prisma.receivable.count({
      where: { tenantId, status: { in: ["pending", "partially_paid"] } },
    }),
    // HR & Recruitment
    prisma.requisition.count({
      where: { tenantId, status: "approved" },
    }),
    prisma.onboardingPlan.count({
      where: { tenantId, status: "in_progress" },
    }),
    // Governance
    prisma.approvalInstance.count({
      where: { tenantId, status: "pending" },
    }),
    prisma.auditEvent.count({
      where: { tenantId },
    }),
  ]);

  // Aggregate opportunity pipeline
  const totalPipelineCents = opportunities.reduce(
    (sum, o) => sum + (o.amountCents ? Number(o.amountCents) : 0),
    0
  );

  // Aggregate billed invoices
  const totalBilledCents = invoices.reduce(
    (sum, inv) => sum + (inv.totalCents ? Number(inv.totalCents) : 0),
    0
  );

  return {
    workforce: {
      totalEmployees,
      departmentBreakdown: departments.map((d) => ({
        department: d.department || "General",
        count: d._count.id,
      })),
      todayAttended,
      todayOnLeave,
      attendanceRatePct: totalEmployees > 0 ? Math.round((todayAttended / totalEmployees) * 100) : 0,
    },
    delivery: {
      activeProjects,
      openTickets,
      resolvedTickets,
      completionRatePct:
        openTickets + resolvedTickets > 0
          ? Math.round((resolvedTickets / (openTickets + resolvedTickets)) * 100)
          : 0,
    },
    sales: {
      totalOpportunities: opportunities.length,
      totalPipelineCents,
      openLeads,
    },
    finance: {
      totalInvoices: invoices.length,
      totalBilledCents,
      unpaidReceivables,
    },
    talent: {
      openRequisitions,
      activeOnboarding,
    },
    governance: {
      pendingApprovals,
      totalAuditEvents,
    },
  };
}

export async function getAuditEvents(tenantId: string, filter: AuditEventFilter = {}) {
  const { eventType, decision, actorUserId, limit = 50, offset = 0 } = filter;

  const where: any = { tenantId };
  if (eventType) where.eventType = eventType;
  if (decision) where.decision = decision;
  if (actorUserId) where.actorUserId = actorUserId;

  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      skip: offset,
    }),
  ]);

  return { total, events, limit, offset };
}

export async function getStageHistory(tenantId: string, filter: StageHistoryFilter = {}) {
  const { entityType, limit = 50, offset = 0 } = filter;

  const where: any = { tenantId };
  if (entityType) where.entityType = entityType;

  const [total, history] = await Promise.all([
    prisma.stageHistory.count({ where }),
    prisma.stageHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      skip: offset,
    }),
  ]);

  return { total, history, limit, offset };
}

export async function exportAuditEventsCsv(tenantId: string, filter: AuditEventFilter = {}) {
  const { events } = await getAuditEvents(tenantId, { ...filter, limit: 1000 });

  const headers = ["Timestamp", "Event Type", "Decision", "Reason Code", "Resource Type", "Actor User ID"];
  const rows = events.map((ev) => [
    ev.createdAt.toISOString(),
    `"${(ev.eventType || "").replace(/"/g, '""')}"`,
    ev.decision || "",
    ev.reasonCode || "",
    ev.resourceType || "",
    ev.actorUserId || "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
