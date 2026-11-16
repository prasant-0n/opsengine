import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.PAYROLL_STRUCTURE_READ, {
    tenantId: ctx.tenantId,
    resourceType: "salary_structure",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const structures = await prisma.salaryStructure.findMany({
    where: { tenantId: ctx.tenantId, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  const employeeIds = structures.map((s) => s.employeeId);
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, tenantId: ctx.tenantId },
    select: { id: true, displayName: true, workEmail: true, department: true },
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const serialized = structures.map((s) => ({
    ...s,
    basicCents: s.basicCents.toString(),
    hraCents: s.hraCents.toString(),
    allowanceCents: s.allowanceCents.toString(),
    pfEmployeeCents: s.pfEmployeeCents.toString(),
    pfEmployerCents: s.pfEmployerCents.toString(),
    taxTdsCents: s.taxTdsCents.toString(),
    employee: empMap.get(s.employeeId) ?? null,
  }));

  return NextResponse.json({ data: serialized });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.PAYROLL_STRUCTURE_MANAGE, {
    tenantId: ctx.tenantId,
    resourceType: "salary_structure",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    employeeId,
    effectiveFrom,
    basicCents,
    hraCents,
    allowanceCents,
    pfEmployeeCents,
    pfEmployerCents,
    taxTdsCents,
    paymentMethod = "bank_transfer",
    bankName,
    bankAccountNumber,
    bankRoutingCode,
  } = body;

  if (!employeeId) {
    return NextResponse.json({ error: "Missing required employeeId" }, { status: 400 });
  }

  const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

  // Archive any existing active structure for this employee
  await prisma.salaryStructure.updateMany({
    where: { tenantId: ctx.tenantId, employeeId, status: "active" },
    data: { status: "archived" },
  });

  const created = await prisma.salaryStructure.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId,
      effectiveFrom: effectiveDate,
      currency: "USD",
      basicCents: BigInt(basicCents || 0),
      hraCents: BigInt(hraCents || 0),
      allowanceCents: BigInt(allowanceCents || 0),
      pfEmployeeCents: BigInt(pfEmployeeCents || 0),
      pfEmployerCents: BigInt(pfEmployerCents || 0),
      taxTdsCents: BigInt(taxTdsCents || 0),
      paymentMethod,
      bankName: bankName || null,
      bankAccountNumber: bankAccountNumber || null,
      bankRoutingCode: bankRoutingCode || null,
      status: "active",
    },
  });

  return NextResponse.json(
    {
      data: {
        ...created,
        basicCents: created.basicCents.toString(),
        hraCents: created.hraCents.toString(),
        allowanceCents: created.allowanceCents.toString(),
        pfEmployeeCents: created.pfEmployeeCents.toString(),
        pfEmployerCents: created.pfEmployerCents.toString(),
        taxTdsCents: created.taxTdsCents.toString(),
      },
    },
    { status: 201 }
  );
}
