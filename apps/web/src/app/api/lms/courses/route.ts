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

  const authz = authorize(ctx, PERMISSIONS.LMS_COURSE_READ, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "lms_course",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const isActiveParam = searchParams.get("isActive");

  const whereClause: any = { tenantId: ctx.tenantId };
  if (category) {
    whereClause.category = category;
  }
  if (isActiveParam !== null) {
    whereClause.isActive = isActiveParam === "true";
  }

  const courses = await prisma.course.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: courses });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.LMS_COURSE_MANAGE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "lms_course",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      code,
      title,
      description,
      category,
      passingScore = 80,
      durationMinutes = 60,
      validityMonths,
      modules = [],
      isActive = true,
    } = body;

    if (!code || !title || !description || !category) {
      return NextResponse.json(
        { error: "code, title, description, and category are required." },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        tenantId: ctx.tenantId,
        code: String(code).trim().toUpperCase(),
        title: String(title).trim(),
        description: String(description).trim(),
        category: String(category).trim().toLowerCase(),
        passingScore: Number(passingScore),
        durationMinutes: Number(durationMinutes),
        validityMonths: validityMonths ? Number(validityMonths) : null,
        modules: Array.isArray(modules) ? modules : [],
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json({ data: course }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A course with this code already exists in this tenant." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create course" },
      { status: 500 }
    );
  }
}
