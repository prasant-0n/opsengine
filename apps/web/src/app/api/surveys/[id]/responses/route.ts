import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

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

  const authz = authorize(ctx, PERMISSIONS.SURVEY_RESPOND, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "survey",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const survey = await prisma.survey.findFirst({
      where: { id, tenantId: ctx.tenantId, status: "active" },
    });

    if (!survey) {
      return NextResponse.json(
        { error: "Active survey not found in this tenant" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { answers = [], npsScore } = body;

    // Detect NPS score from answers if not explicitly passed
    let resolvedNpsScore = typeof npsScore === "number" ? npsScore : null;
    if (resolvedNpsScore === null && Array.isArray(answers)) {
      const npsAns = answers.find((a: any) => typeof a.score === "number" && a.score >= 0 && a.score <= 10);
      if (npsAns) {
        resolvedNpsScore = npsAns.score;
      }
    }

    // Cryptographic Unlinkability: Nullify employeeId if survey is anonymous
    const storedEmployeeId = survey.isAnonymous ? null : ctx.employeeId;

    const response = await prisma.surveyResponse.create({
      data: {
        tenantId: ctx.tenantId,
        surveyId: survey.id,
        employeeId: storedEmployeeId,
        answers: Array.isArray(answers) ? answers : [],
        npsScore: resolvedNpsScore,
      },
    });

    return NextResponse.json(
      {
        message: "Survey response recorded successfully.",
        data: {
          id: response.id,
          surveyId: response.surveyId,
          isAnonymous: survey.isAnonymous,
          submittedAt: response.submittedAt,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record survey response" },
      { status: 500 }
    );
  }
}
