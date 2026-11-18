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

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const status = searchParams.get("status");
  const skillName = searchParams.get("skillName");

  const whereClause: any = { tenantId: ctx.tenantId };
  if (employeeId) {
    whereClause.employeeId = employeeId;
  }
  if (status) {
    whereClause.status = status;
  }
  if (skillName) {
    whereClause.skillName = { contains: skillName, mode: "insensitive" };
  }

  const certs = await prisma.skillCertification.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: certs });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      skillName,
      proficiencyLevel = "intermediate",
      issuingAuthority,
      credentialId,
      verificationUrl,
      issuedAt,
      expiresAt,
    } = body;

    if (!skillName || !issuingAuthority) {
      return NextResponse.json(
        { error: "skillName and issuingAuthority are required" },
        { status: 400 }
      );
    }

    const validLevels = ["beginner", "intermediate", "advanced", "expert"];
    if (!validLevels.includes(String(proficiencyLevel).toLowerCase())) {
      return NextResponse.json(
        { error: "proficiencyLevel must be one of: beginner, intermediate, advanced, expert" },
        { status: 400 }
      );
    }

    const cert = await prisma.skillCertification.create({
      data: {
        tenantId: ctx.tenantId,
        employeeId: ctx.employeeId,
        skillName: String(skillName).trim(),
        proficiencyLevel: String(proficiencyLevel).trim().toLowerCase(),
        issuingAuthority: String(issuingAuthority).trim(),
        credentialId: credentialId ? String(credentialId).trim() : null,
        verificationUrl: verificationUrl ? String(verificationUrl).trim() : null,
        status: "pending_verification",
        issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({ data: cert }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A certification for this skill and credential ID already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit certification" },
      { status: 500 }
    );
  }
}
