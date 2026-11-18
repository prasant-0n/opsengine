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
  const courseId = searchParams.get("courseId");
  const status = searchParams.get("status");

  // Determine authorization: self vs team/tenant
  const canManageTeam = authorize(ctx, PERMISSIONS.LMS_ENROLLMENT_MANAGE_TEAM, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "lms_enrollment",
  }).allowed;

  const targetEmployeeId = employeeId || (canManageTeam ? undefined : ctx.employeeId);

  if (targetEmployeeId && targetEmployeeId !== ctx.employeeId && !canManageTeam) {
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions to view other employee enrollments" },
      { status: 403 }
    );
  }

  const whereClause: any = { tenantId: ctx.tenantId };
  if (targetEmployeeId) {
    whereClause.employeeId = targetEmployeeId;
  }
  if (courseId) {
    whereClause.courseId = courseId;
  }
  if (status) {
    whereClause.status = status;
  }

  const enrollments = await prisma.courseEnrollment.findMany({
    where: whereClause,
    orderBy: { enrolledAt: "desc" },
  });

  return NextResponse.json({ data: enrollments });
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
    const { courseId, employeeId: requestedEmpId, enrollmentType } = body;

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    const targetEmployeeId = requestedEmpId || ctx.employeeId;

    if (targetEmployeeId !== ctx.employeeId) {
      const authz = authorize(ctx, PERMISSIONS.LMS_ENROLLMENT_MANAGE_TEAM, {
        tenantId: ctx.tenantId,
        owningEmployeeId: targetEmployeeId,
        resourceType: "lms_enrollment",
      });
      if (!authz.allowed) {
        return NextResponse.json(
          { error: "Forbidden: insufficient permissions to assign courses to team members" },
          { status: 403 }
        );
      }
    } else {
      const authz = authorize(ctx, PERMISSIONS.LMS_ENROLLMENT_MANAGE_SELF, {
        tenantId: ctx.tenantId,
        owningEmployeeId: ctx.employeeId,
        resourceType: "lms_enrollment",
      });
      if (!authz.allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Verify course exists in tenant
    const course = await prisma.course.findFirst({
      where: { id: courseId, tenantId: ctx.tenantId, isActive: true },
    });
    if (!course) {
      return NextResponse.json(
        { error: "Active course not found in this tenant" },
        { status: 404 }
      );
    }

    const resolvedEnrollmentType =
      enrollmentType || (targetEmployeeId !== ctx.employeeId ? "manager_assigned" : "self_enrolled");

    const enrollment = await prisma.courseEnrollment.upsert({
      where: {
        tenantId_courseId_employeeId: {
          tenantId: ctx.tenantId,
          courseId,
          employeeId: targetEmployeeId,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        courseId,
        employeeId: targetEmployeeId,
        enrollmentType: resolvedEnrollmentType,
        status: "enrolled",
        progressPercent: 0,
      },
      update: {
        enrollmentType: resolvedEnrollmentType,
        status: "enrolled",
      },
    });

    return NextResponse.json({ data: enrollment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to enroll in course" },
      { status: 500 }
    );
  }
}
