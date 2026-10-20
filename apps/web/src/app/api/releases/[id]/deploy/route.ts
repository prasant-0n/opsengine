import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireReleaseAuthz, isResponse } from "../../_lib";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReleaseAuthz(PERMISSIONS.RELEASE_APPROVE, { resourceType: "release" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const release = await prisma.release.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { gates: true },
  });
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (release.status !== "approved") {
    return NextResponse.json({ error: "Release must be approved before deployment", code: "NOT_APPROVED" }, { status: 409 });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const rel = await tx.release.update({
      where: { id: release.id },
      data: {
        status: "deployed",
        deployedAt: now,
      },
      include: { gates: true },
    });

    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "release",
        entityId: release.id,
        fromStatus: release.status,
        toStatus: "deployed",
        actorId: ctx.userId,
        reason: "Release successfully deployed to target environment.",
      },
    });

    return rel;
  });

  return NextResponse.json({ release: updated });
}
