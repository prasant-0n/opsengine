import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.EXPENSE_REPORT_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "expense_receipt",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const fileName = (body.fileName ?? "receipt.pdf").trim();
    const mimeType = (body.mimeType ?? "application/pdf").trim();
    const fileSize = Math.max(Number(body.fileSize) || 1024, 1);
    const providedHash = body.sha256Hash ? String(body.sha256Hash).trim() : null;

    // Generate or use provided SHA-256 hash
    const sha256Hash =
      providedHash ||
      crypto
        .createHash("sha256")
        .update(`${ctx.tenantId}-${ctx.employeeId}-${fileName}-${Date.now()}`)
        .digest("hex");

    const storageKey = `receipts/${ctx.tenantId}/${ctx.employeeId}/${Date.now()}-${fileName}`;

    const receipt = await prisma.expenseReceipt.create({
      data: {
        tenantId: ctx.tenantId,
        employeeId: ctx.employeeId,
        storageKey,
        fileName,
        fileSize,
        mimeType,
        sha256Hash,
      },
    });

    return NextResponse.json({ data: receipt }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to upload receipt" },
      { status: 400 }
    );
  }
}
