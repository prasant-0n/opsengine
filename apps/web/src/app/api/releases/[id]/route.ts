import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireReleaseAuthz, isResponse } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReleaseAuthz(PERMISSIONS.RELEASE_READ, { resourceType: "release" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const release = await prisma.release.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { gates: true },
  });
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ release });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReleaseAuthz(PERMISSIONS.RELEASE_CREATE, { resourceType: "release" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const release = await prisma.release.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (release.status !== "draft" && release.status !== "review") {
    return NextResponse.json({ error: "Only draft or review releases can be edited", code: "NOT_EDITABLE" }, { status: 409 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if ("status" in body) return NextResponse.json({ error: "Status changes are governed actions", code: "GOVERNED_ACTION" }, { status: 400 });

  const data: any = {};
  if (body.title !== undefined) data.title = typeof body.title === "string" ? body.title.trim() : release.title;
  if (body.targetEnv !== undefined) data.targetEnv = typeof body.targetEnv === "string" ? body.targetEnv.trim() : release.targetEnv;
  if (body.changeWindow !== undefined) data.changeWindow = typeof body.changeWindow === "string" ? body.changeWindow : null;
  if (body.rollbackPlan !== undefined) data.rollbackPlan = typeof body.rollbackPlan === "string" ? body.rollbackPlan : null;
  if (body.qaEvidenceRef !== undefined) data.qaEvidenceRef = typeof body.qaEvidenceRef === "string" ? body.qaEvidenceRef : null;

  const updated = await prisma.release.update({
    where: { id: release.id },
    data,
    include: { gates: true },
  });

  return NextResponse.json({ release: updated });
}
