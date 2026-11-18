import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { calculateOkrProgress } from "@/features/appraisals/lib/appraisal-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.OKR_READ, {
    tenantId: ctx.tenantId,
    resourceType: "okr_objective",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const quarterParam = searchParams.get("quarter");

  const whereCondition: any = { tenantId: ctx.tenantId };
  if (yearParam) whereCondition.periodYear = parseInt(yearParam, 10);
  if (quarterParam) whereCondition.periodQuarter = parseInt(quarterParam, 10);

  const objectives = await prisma.okrObjective.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
  });

  const objIds = objectives.map((o) => o.id);
  const keyResults = await prisma.okrKeyResult.findMany({
    where: { objectiveId: { in: objIds }, tenantId: ctx.tenantId },
  });

  const krMap = new Map<string, any[]>();
  keyResults.forEach((kr) => {
    const list = krMap.get(kr.objectiveId) || [];
    list.push(kr);
    krMap.set(kr.objectiveId, list);
  });

  const enriched = objectives.map((obj) => {
    const krs = krMap.get(obj.id) || [];
    const progress = calculateOkrProgress(krs);
    return {
      ...obj,
      progressPercent: progress,
      keyResults: krs,
    };
  });

  return NextResponse.json({ data: enriched });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.OKR_MANAGE, {
    tenantId: ctx.tenantId,
    resourceType: "okr_objective",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    title,
    description,
    level = "company",
    department,
    ownerEmployeeId,
    periodYear,
    periodQuarter,
    keyResults = [],
  } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const year = parseInt(periodYear, 10) || new Date().getUTCFullYear();
  const quarter = parseInt(periodQuarter, 10) || Math.floor(new Date().getUTCMonth() / 3) + 1;

  const objective = await prisma.okrObjective.create({
    data: {
      tenantId: ctx.tenantId,
      title,
      description: description || null,
      level,
      department: department || null,
      ownerEmployeeId: ownerEmployeeId || ctx.employeeId,
      periodYear: year,
      periodQuarter: quarter,
      status: "active",
    },
  });

  const createdKrs: any[] = [];
  for (const kr of keyResults) {
    const createdKr = await prisma.okrKeyResult.create({
      data: {
        tenantId: ctx.tenantId,
        objectiveId: objective.id,
        title: kr.title || "Key Result",
        targetValue: parseFloat(kr.targetValue) || 100.0,
        currentValue: parseFloat(kr.currentValue) || 0.0,
        unit: kr.unit || "%",
        confidenceScore: parseFloat(kr.confidenceScore) || 0.7,
      },
    });
    createdKrs.push(createdKr);
  }

  const progress = calculateOkrProgress(createdKrs);
  await prisma.okrObjective.update({
    where: { id: objective.id },
    data: { progressPercent: progress },
  });

  return NextResponse.json(
    { data: { ...objective, progressPercent: progress, keyResults: createdKrs } },
    { status: 201 }
  );
}
