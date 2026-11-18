import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { evaluateCourseProgress, EnrollmentStatus } from "@/features/lms/lib/lms-engine";

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
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const isSelf = enrollment.employeeId === ctx.employeeId;
    if (!isSelf) {
      const authz = authorize(ctx, PERMISSIONS.LMS_ENROLLMENT_MANAGE_TEAM, {
        tenantId: ctx.tenantId,
        owningEmployeeId: enrollment.employeeId,
        resourceType: "lms_enrollment",
      });
      if (!authz.allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const course = await prisma.course.findFirst({
      where: { id: enrollment.courseId, tenantId: ctx.tenantId },
    });

    if (!course) {
      return NextResponse.json({ error: "Associated course not found" }, { status: 404 });
    }

    const body = await req.json();
    const { progressPercent, score } = body;

    if (progressPercent === undefined || typeof progressPercent !== "number") {
      return NextResponse.json({ error: "Numeric progressPercent is required" }, { status: 400 });
    }

    const evaluation = evaluateCourseProgress({
      currentStatus: enrollment.status as EnrollmentStatus,
      currentProgress: enrollment.progressPercent,
      newProgress: progressPercent,
      newScore: score,
      passingScore: course.passingScore,
      validityMonths: course.validityMonths,
    });

    const updated = await prisma.courseEnrollment.update({
      where: { id },
      data: {
        status: evaluation.status,
        progressPercent: evaluation.progressPercent,
        score: evaluation.score,
        completedAt: evaluation.completedAt,
        expiresAt: evaluation.expiresAt,
      },
    });

    return NextResponse.json({
      data: updated,
      evaluation: {
        isPassed: evaluation.isPassed,
        status: evaluation.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update enrollment progress" },
      { status: 500 }
    );
  }
}
