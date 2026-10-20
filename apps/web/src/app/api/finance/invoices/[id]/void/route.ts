import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializeInvoice } from "../../../_lib";
import { canVoid } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_ISSUE, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.reason || typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json({ error: "A reason is required to void an invoice" }, { status: 400 });
  }
  if (!canVoid(invoice)) return NextResponse.json({ error: "A paid invoice cannot be voided" }, { status: 409 });

  const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "void" } });
  await prisma.stageHistory.create({
    data: {
      tenantId: ctx.tenantId,
      entityType: "invoice",
      entityId: invoice.id,
      fromStatus: invoice.status,
      toStatus: "void",
      actorId: ctx.userId,
      reason: body.reason,
    },
  });
  return NextResponse.json({ invoice: serializeInvoice(updated) });
}
