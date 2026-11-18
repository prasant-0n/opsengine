import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { calculateCertificationIntegrityHash } from "@/features/lms/lib/lms-engine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const cert = await prisma.skillCertification.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!cert) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    const authz = authorize(ctx, PERMISSIONS.LMS_CERTIFICATION_VERIFY, {
      tenantId: ctx.tenantId,
      owningEmployeeId: cert.employeeId,
      resourceType: "lms_certification",
    });

    if (!authz.allowed) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions to verify skill certifications" },
        { status: 403 }
      );
    }

    // Segregation of Duties (SoD): Verifier should not be self unless system admin
    const isElevated = ctx.roles.some((r) => r.key === "admin" || r.key === "owner");
    if (cert.employeeId === ctx.employeeId && !isElevated) {
      return NextResponse.json(
        { error: "Segregation of Duties: you cannot verify your own skill certification" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (!action || !["verify", "reject"].includes(action)) {
      return NextResponse.json(
        { error: 'action must be either "verify" or "reject"' },
        { status: 400 }
      );
    }

    const verifiedAt = new Date();

    if (action === "verify") {
      const verificationHash = calculateCertificationIntegrityHash({
        id: cert.id,
        tenantId: cert.tenantId,
        employeeId: cert.employeeId,
        skillName: cert.skillName,
        proficiencyLevel: cert.proficiencyLevel,
        issuingAuthority: cert.issuingAuthority,
        credentialId: cert.credentialId,
        issuedAt: cert.issuedAt,
        verifiedBy: ctx.employeeId,
        verifiedAt,
      });

      const updated = await prisma.skillCertification.update({
        where: { id },
        data: {
          status: "verified",
          verifiedBy: ctx.employeeId,
          verifiedAt,
          verificationHash,
        },
      });

      return NextResponse.json({
        message: "Certification verified successfully with tamper-evident proof",
        data: updated,
      });
    } else {
      const updated = await prisma.skillCertification.update({
        where: { id },
        data: {
          status: "rejected",
          verifiedBy: ctx.employeeId,
          verifiedAt,
        },
      });

      return NextResponse.json({
        message: "Certification rejected",
        data: updated,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify certification" },
      { status: 500 }
    );
  }
}
