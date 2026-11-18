import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  calculateCompositeAppraisalScore,
  evaluateCalibrationDistribution,
} from "@/features/appraisals/lib/appraisal-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.APPRAISAL_CALIBRATE, {
    tenantId: ctx.tenantId,
    resourceType: "appraisal_cycle",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { cycleId } = body;

  if (!cycleId) {
    return NextResponse.json({ error: "cycleId is required" }, { status: 400 });
  }

  const cycle = await prisma.appraisalCycle.findFirst({
    where: { id: cycleId, tenantId: ctx.tenantId },
  });

  if (!cycle) {
    return NextResponse.json({ error: "Appraisal cycle not found" }, { status: 404 });
  }

  // Fetch all reviews for this cycle
  const reviews = await prisma.appraisalReview.findMany({
    where: { cycleId: cycle.id, tenantId: ctx.tenantId },
  });

  // Group reviews by employee
  const reviewsByEmp = new Map<string, any[]>();
  reviews.forEach((r) => {
    const list = reviewsByEmp.get(r.employeeId) || [];
    list.push(r);
    reviewsByEmp.set(r.employeeId, list);
  });

  const employeeCalibrations: any[] = [];
  const allFinalScores: number[] = [];

  for (const [empId, empReviews] of Array.from(reviewsByEmp.entries())) {
    // Find OKR progress for employee
    const objectives = await prisma.okrObjective.findMany({
      where: { ownerEmployeeId: empId, tenantId: ctx.tenantId },
    });
    const okrProgress = objectives.length
      ? objectives.reduce((acc, o) => acc + o.progressPercent, 0) / objectives.length
      : 80.0; // Baseline assumption if unconfigured

    const scoreResult = calculateCompositeAppraisalScore(
      empReviews.map((r) => ({
        reviewType: r.reviewType as any,
        overallRating: r.overallRating,
      })),
      okrProgress
    );

    allFinalScores.push(scoreResult.finalScore);

    employeeCalibrations.push({
      employeeId: empId,
      reviewsCount: empReviews.length,
      ...scoreResult,
    });
  }

  // Update reviews to calibrated
  await prisma.appraisalReview.updateMany({
    where: { cycleId: cycle.id, tenantId: ctx.tenantId },
    data: { status: "calibrated" },
  });

  // Update cycle status to calibration
  await prisma.appraisalCycle.update({
    where: { id: cycle.id },
    data: { status: "calibration" },
  });

  const distribution = evaluateCalibrationDistribution(allFinalScores);

  return NextResponse.json({
    data: {
      cycleId: cycle.id,
      cycleName: cycle.name,
      calibratedEmployeesCount: employeeCalibrations.length,
      employeeCalibrations,
      distribution,
    },
  });
}
