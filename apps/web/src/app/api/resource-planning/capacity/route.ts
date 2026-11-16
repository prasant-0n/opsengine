import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { computeUtilizationStatus, aggregateSbuCapacity } from "@/features/resource-planning/lib/resource-planning";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.RESOURCE_PLANNING_READ, {
    tenantId: ctx.tenantId,
    resourceType: "resource_planning",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [employees, allocations] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId: ctx.tenantId, employmentStatus: "active" },
      select: { id: true, displayName: true, department: true, jobTitle: true },
    }),
    prisma.allocation.findMany({
      where: { tenantId: ctx.tenantId },
      select: { employeeId: true, percentage: true },
    }),
  ]);

  const allocationMap = new Map<string, number>();
  for (const alloc of allocations) {
    const cur = allocationMap.get(alloc.employeeId) ?? 0;
    allocationMap.set(alloc.employeeId, cur + alloc.percentage);
  }

  const summaries = employees.map((emp) => {
    const totalAllocatedPct = allocationMap.get(emp.id) ?? 0;
    return {
      employeeId: emp.id,
      displayName: emp.displayName,
      department: emp.department ?? "General",
      jobTitle: emp.jobTitle ?? "—",
      totalAllocatedPct,
      utilizationStatus: computeUtilizationStatus(totalAllocatedPct),
    };
  });

  const metrics = aggregateSbuCapacity(summaries);

  return NextResponse.json({ summaries, metrics });
}
