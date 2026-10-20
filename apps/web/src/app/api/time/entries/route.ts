import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isValidMinutes, sumTimeEntries, weekRange } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeIdParam = (searchParams.get("employeeId") ?? "").trim();
  const fromParam = (searchParams.get("from") ?? "").trim();
  const toParam = (searchParams.get("to") ?? "").trim();

  const targetEmployeeId = employeeIdParam || ctx.employeeId;
  const isSelf = targetEmployeeId === ctx.employeeId;

  const perm = isSelf ? PERMISSIONS.TIME_ENTRY_READ_SELF : PERMISSIONS.TIME_REPORT_READ_TEAM;
  const authz = authorize(ctx, perm, {
    tenantId: ctx.tenantId,
    resourceType: "time_entry",
    owningEmployeeId: targetEmployeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let fromDate: Date, toDate: Date;
  if (fromParam && toParam) {
    fromDate = new Date(fromParam + "T00:00:00Z");
    toDate = new Date(toParam + "T00:00:00Z");
  } else {
    const w = weekRange((searchParams.get("date") ?? new Date().toISOString().slice(0, 10)).trim());
    fromDate = new Date(w.start + "T00:00:00Z");
    toDate = new Date(w.end + "T00:00:00Z");
  }

  const where: any = {
    tenantId: ctx.tenantId,
    employeeId: targetEmployeeId,
    entryDate: { gte: fromDate, lte: toDate },
  };
  const projectId = (searchParams.get("projectId") ?? "").trim();
  if (projectId) where.projectId = projectId;

  const rows = await prisma.timeEntry.findMany({ where, orderBy: { entryDate: "desc" }, take: 200 });
  const projIds = Array.from(new Set(rows.map((r) => r.projectId).filter((x): x is string => !!x)));
  const ticketIds = Array.from(new Set(rows.map((r) => r.ticketId).filter((x): x is string => !!x)));
  const [projs, tickets] = await Promise.all([
    projIds.length ? prisma.project.findMany({ where: { id: { in: projIds }, tenantId: ctx.tenantId }, select: { id: true, name: true, code: true } }) : [],
    ticketIds.length ? prisma.ticket.findMany({ where: { id: { in: ticketIds }, tenantId: ctx.tenantId }, select: { id: true, title: true } }) : [],
  ]);
  const projName = new Map(projs.map((p) => [p.id, `${p.code} · ${p.name}`]));
  const ticketName = new Map(tickets.map((t) => [t.id, t.title]));

  const entries = rows.map((r) => ({
    ...r,
    projectName: r.projectId ? (projName.get(r.projectId) ?? null) : null,
    ticketTitle: r.ticketId ? (ticketName.get(r.ticketId) ?? null) : null,
  }));
  const totals = sumTimeEntries(entries);
  return NextResponse.json({ entries, totals, from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TIME_ENTRY_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "time_entry",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.entryDate || typeof body.entryDate !== "string") return NextResponse.json({ error: "Missing entryDate" }, { status: 400 });
  const minutes = typeof body.minutes === "string" ? parseInt(body.minutes, 10) : body.minutes;
  if (!isValidMinutes(minutes)) return NextResponse.json({ error: "minutes must be integer 1–1440" }, { status: 400 });

  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });
  const employeeId = body.employeeId ?? ctx.employeeId;
  if (employeeId !== ctx.employeeId) return NextResponse.json({ error: "Cannot log time for another employee" }, { status: 403 });

  if (body.projectId) {
    const ok = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ok) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }
  if (body.ticketId) {
    const ok = await prisma.ticket.findFirst({ where: { id: body.ticketId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ok) return NextResponse.json({ error: "Invalid ticketId" }, { status: 400 });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId,
      entryDate: new Date(body.entryDate + "T00:00:00Z"),
      projectId: body.projectId ?? null,
      ticketId: body.ticketId ?? null,
      minutes,
      billable: !!body.billable,
      note: body.note ?? null,
    },
  });
  return NextResponse.json({ entry }, { status: 201 });
}
