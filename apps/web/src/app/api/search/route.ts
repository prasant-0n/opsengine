import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const tenantId = ctx.tenantId;
  const results: Array<{ category: string; title: string; subtitle: string; href: string }> = [];

  // 1. Employees (HRMS)
  const canOrg = authorize(ctx, PERMISSIONS.ORG_READ_DIRECTORY, { tenantId, resourceType: "employee" }).allowed;
  if (canOrg) {
    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { workEmail: { contains: q, mode: "insensitive" } },
          { jobTitle: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    });
    for (const e of employees) {
      results.push({
        category: "People",
        title: e.displayName,
        subtitle: `${e.jobTitle ?? "Employee"} · ${e.workEmail ?? ""}`,
        href: `/dashboard/people/${e.id}`,
      });
    }
  }

  // 2. CRM Accounts & Opportunities
  const canCrm = authorize(ctx, PERMISSIONS.CRM_OPPORTUNITY_READ, { tenantId, resourceType: "crm_opportunity" }).allowed;
  if (canCrm) {
    const [accounts, opportunities] = await Promise.all([
      prisma.crmAccount.findMany({
        where: { tenantId, name: { contains: q, mode: "insensitive" } },
        take: 3,
      }),
      prisma.crmOpportunity.findMany({
        where: { tenantId, name: { contains: q, mode: "insensitive" } },
        take: 3,
      }),
    ]);
    for (const a of accounts) {
      results.push({
        category: "CRM Accounts",
        title: a.name,
        subtitle: `${a.industry ?? "Account"} · ${a.clientTier ?? ""}`,
        href: `/dashboard/crm/accounts/${a.id}`,
      });
    }
    for (const o of opportunities) {
      results.push({
        category: "CRM Opportunities",
        title: o.name,
        subtitle: `Stage: ${o.stage} · Prob: ${o.probability ?? 0}%`,
        href: `/dashboard/crm/opportunities/${o.id}`,
      });
    }
  }

  // 3. Projects & Tickets
  const canProject = authorize(ctx, PERMISSIONS.PROJECT_READ, { tenantId, resourceType: "project" }).allowed;
  if (canProject) {
    const [projects, tickets] = await Promise.all([
      prisma.project.findMany({
        where: { tenantId, name: { contains: q, mode: "insensitive" } },
        take: 3,
      }),
      prisma.ticket.findMany({
        where: { tenantId, title: { contains: q, mode: "insensitive" } },
        take: 3,
      }),
    ]);
    for (const p of projects) {
      results.push({
        category: "Projects",
        title: p.name,
        subtitle: `Status: ${p.status} · ${p.code ?? ""}`,
        href: `/dashboard/projects/${p.id}`,
      });
    }
    for (const t of tickets) {
      results.push({
        category: "Tickets",
        title: t.title,
        subtitle: `Priority: ${t.priority} · Status: ${t.status}`,
        href: `/dashboard/tickets/${t.id}`,
      });
    }
  }

  // 4. Invoices (Finance)
  const canFinance = authorize(ctx, PERMISSIONS.FINANCE_INVOICE_READ, { tenantId, resourceType: "invoice" }).allowed;
  if (canFinance) {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, number: { contains: q, mode: "insensitive" } },
      take: 3,
    });
    for (const inv of invoices) {
      results.push({
        category: "Invoices",
        title: inv.number,
        subtitle: `Status: ${inv.status} · Total: ${inv.totalCents.toString()}`,
        href: `/dashboard/finance/invoices/${inv.id}`,
      });
    }
  }

  // 5. Recruitment Candidates & Requisitions
  const canRecruit = authorize(ctx, PERMISSIONS.RECRUIT_REQUISITION_READ, { tenantId, resourceType: "requisition" }).allowed;
  if (canRecruit) {
    const [reqs, candidates] = await Promise.all([
      prisma.requisition.findMany({
        where: { tenantId, jobTitle: { contains: q, mode: "insensitive" } },
        take: 3,
      }),
      prisma.candidate.findMany({
        where: { tenantId, fullName: { contains: q, mode: "insensitive" } },
        take: 3,
      }),
    ]);
    for (const r of reqs) {
      results.push({
        category: "Requisitions",
        title: r.jobTitle,
        subtitle: `Status: ${r.status} · Headcount: ${r.headcount}`,
        href: `/dashboard/recruit/requisitions/${r.id}`,
      });
    }
    for (const c of candidates) {
      results.push({
        category: "Candidates",
        title: c.fullName,
        subtitle: `Status: ${c.status} · ${c.email ?? ""}`,
        href: `/dashboard/recruit/candidates/${c.id}`,
      });
    }
  }

  return NextResponse.json({ results });
}
