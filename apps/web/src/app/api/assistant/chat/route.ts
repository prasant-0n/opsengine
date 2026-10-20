import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAssistantAuthz, isResponse } from "../_lib";
import { isTenantAiEnabled, queryGemini } from "@/features/assistant/lib/assistant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAssistantAuthz(PERMISSIONS.ASSISTANT_USE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const enabled = await isTenantAiEnabled(ctx.tenantId);
  if (!enabled) {
    return NextResponse.json({ error: "AI features are not enabled for this organization. Contact your system operator.", code: "AI_NOT_ENABLED" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const [employees, rawInvoices, projects] = await Promise.all([
    prisma.employee.count({ where: { tenantId: ctx.tenantId, employmentStatus: "active" } }),
    prisma.invoice.findMany({ where: { tenantId: ctx.tenantId, status: { not: "paid" } }, take: 5, select: { number: true, totalCents: true, currency: true, dueOn: true } }),
    prisma.project.findMany({ where: { tenantId: ctx.tenantId }, take: 5, select: { name: true, status: true } }),
  ]);

  const invoices = rawInvoices.map((inv) => ({
    ...inv,
    totalCents: inv.totalCents?.toString() ?? "0",
  }));

  const contextSummary = `Organization Active Employees: ${employees}
Unpaid Invoices: ${JSON.stringify(invoices)}
Active Projects: ${JSON.stringify(projects)}
User Roles: ${ctx.roles.join(", ")}`;

  const responseText = await queryGemini(prompt, contextSummary);

  await prisma.auditEvent.create({
    data: {
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      eventType: "AI_ASSISTANT_QUERY",
      resourceType: "ai_assistant",
      decision: "allow",
      metadata: { promptLength: prompt.length },
    },
  });

  return NextResponse.json({ response: responseText });
}
