import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireReleaseAuthz, isResponse } from "../../_lib";
import { isKnownGateStatus } from "@/features/releases/lib/releases";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReleaseAuthz(PERMISSIONS.RELEASE_GATE_MANAGE, { resourceType: "release" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const release = await prisma.release.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { gates: true },
  });
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const gateId = typeof body.gateId === "string" ? body.gateId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes : null;

  if (!gateId || !isKnownGateStatus(status)) {
    return NextResponse.json({ error: "Valid gateId and status (pending|passed|failed|waived) are required" }, { status: 400 });
  }

  const gate = release.gates.find((g) => g.id === gateId);
  if (!gate) return NextResponse.json({ error: "Gate not found on this release" }, { status: 404 });

  const updatedGate = await prisma.releaseGate.update({
    where: { id: gate.id },
    data: {
      status,
      checkedBy: ctx.userId,
      checkedAt: new Date(),
      notes,
    },
  });

  const allGates = await prisma.releaseGate.findMany({ where: { tenantId: ctx.tenantId, releaseId: release.id } });
  return NextResponse.json({ gate: updatedGate, gates: allGates });
}
