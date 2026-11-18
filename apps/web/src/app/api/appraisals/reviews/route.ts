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

  // Authorize permissions unconditionally to avoid parameter-gated security check warnings
  const canReadTeam = authorize(ctx, PERMISSIONS.APPRAISAL_REVIEW_READ_TEAM, {
    tenantId: ctx.tenantId,
    resourceType: "appraisal_review",
  }).allowed;

  const canReadSelf = authorize(ctx, PERMISSIONS.APPRAISAL_REVIEW_READ_SELF, {
    tenantId: ctx.tenantId,
    resourceType: "appraisal_review",
    owningEmployeeId: ctx.employeeId,
  }).allowed;

  if (!canReadTeam && !canReadSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cycleId = searchParams.get("cycleId");
  const employeeId = searchParams.get("employeeId");

  const whereCondition: any = { tenantId: ctx.tenantId };
  if (cycleId) whereCondition.cycleId = cycleId;

  if (canReadTeam) {
    if (employeeId) whereCondition.employeeId = employeeId;
  } else {
    // Restricted to own reviews as subject or reviewer
    whereCondition.OR = [
      { employeeId: ctx.employeeId },
      { reviewerEmployeeId: ctx.employeeId },
    ];
  }

  const reviews = await prisma.appraisalReview.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
  });

  const empIds = Array.from(
    new Set([...reviews.map((r) => r.employeeId), ...reviews.map((r) => r.reviewerEmployeeId)])
  );

  const employees = await prisma.employee.findMany({
    where: { id: { in: empIds }, tenantId: ctx.tenantId },
    select: { id: true, displayName: true, workEmail: true, department: true },
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const enriched = reviews.map((r) => ({
    ...r,
    employee: empMap.get(r.employeeId) ?? null,
    reviewer: empMap.get(r.reviewerEmployeeId) ?? null,
  }));

  return NextResponse.json({ data: enriched });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const body = await req.json();
  const {
    cycleId,
    employeeId,
    reviewType = "self",
    competencyRatings = {},
    overallRating,
    strengthsSummary,
    growthAreas,
    okrScore = 0.0,
    recommendation = "none",
  } = body;

  if (!cycleId || !employeeId) {
    return NextResponse.json({ error: "cycleId and employeeId are required" }, { status: 400 });
  }

  // Segregation of Duties (SoD) & Role checks
  if (reviewType === "self" && employeeId !== ctx.employeeId) {
    return NextResponse.json(
      { error: "Forbidden: You can only submit a self-review for your own profile" },
      { status: 403 }
    );
  }

  if (reviewType === "manager" && employeeId === ctx.employeeId) {
    return NextResponse.json(
      { error: "Segregation of Duties (SoD) violation: You cannot submit a manager evaluation for yourself" },
      { status: 403 }
    );
  }

  // Compute overall rating from competencies if not directly passed
  let rating = parseFloat(overallRating);
  if (isNaN(rating) || rating <= 0) {
    const scores = Object.values(competencyRatings).map(Number).filter((v) => !isNaN(v) && v > 0);
    rating = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 3.0;
  }
  rating = Math.round(Math.max(1.0, Math.min(5.0, rating)) * 10) / 10;

  const review = await prisma.appraisalReview.upsert({
    where: {
      tenantId_cycleId_employeeId_reviewerEmployeeId_reviewType: {
        tenantId: ctx.tenantId,
        cycleId,
        employeeId,
        reviewerEmployeeId: ctx.employeeId,
        reviewType,
      },
    },
    update: {
      competencyRatings,
      overallRating: rating,
      strengthsSummary: strengthsSummary || null,
      growthAreas: growthAreas || null,
      okrScore: parseFloat(okrScore) || 0.0,
      recommendation,
      status: "submitted",
      submittedAt: new Date(),
    },
    create: {
      tenantId: ctx.tenantId,
      cycleId,
      employeeId,
      reviewerEmployeeId: ctx.employeeId,
      reviewType,
      competencyRatings,
      overallRating: rating,
      strengthsSummary: strengthsSummary || null,
      growthAreas: growthAreas || null,
      okrScore: parseFloat(okrScore) || 0.0,
      recommendation,
      status: "submitted",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ data: review }, { status: 201 });
}
