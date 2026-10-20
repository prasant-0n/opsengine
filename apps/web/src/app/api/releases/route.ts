import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireReleaseAuthz, isResponse } from "./_lib";
import { RELEASE_STATUSES, RELEASE_GATE_TYPES } from "@/features/releases/lib/releases";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireReleaseAuthz(PERMISSIONS.RELEASE_READ, { resourceType: "release" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const env = (searchParams.get("env") ?? "").trim();

  const where: any = { tenantId: ctx.tenantId };
  if (status && (RELEASE_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (env) where.targetEnv = env;

  const releases = await prisma.release.findMany({
    where,
    include: { gates: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ releases });
}

export async function POST(req: NextRequest) {
  const auth = await requireReleaseAuthz(PERMISSIONS.RELEASE_CREATE, { resourceType: "release" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const number = typeof body.number === "string" ? body.number.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const targetEnv = typeof body.targetEnv === "string" ? body.targetEnv.trim() : "staging";

  if (!number || !title) {
    return NextResponse.json({ error: "number and title are required" }, { status: 400 });
  }

  const release = await prisma.$transaction(async (tx) => {
    const rel = await tx.release.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        title,
        targetEnv,
        status: "draft",
        ownerEmployeeId: ctx.employeeId,
        changeWindow: typeof body.changeWindow === "string" ? body.changeWindow : null,
        rollbackPlan: typeof body.rollbackPlan === "string" ? body.rollbackPlan : null,
        qaEvidenceRef: typeof body.qaEvidenceRef === "string" ? body.qaEvidenceRef : null,
        createdBy: ctx.userId,
      },
    });

    // Automatically create default gates (qa, security, change_management, technical)
    for (const gt of RELEASE_GATE_TYPES) {
      await tx.releaseGate.create({
        data: {
          tenantId: ctx.tenantId,
          releaseId: rel.id,
          gateType: gt,
          status: "pending",
        },
      });
    }

    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "release",
        entityId: rel.id,
        toStatus: "draft",
        actorId: ctx.userId,
        reason: "Release created",
      },
    });

    return tx.release.findFirst({ where: { id: rel.id }, include: { gates: true } });
  });

  return NextResponse.json({ release }, { status: 201 });
}
