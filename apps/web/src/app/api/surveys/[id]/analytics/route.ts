import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { aggregateSurveyAnalytics, SurveyQuestion } from "@/features/surveys-recognition/lib/surveys-engine";

export const dynamic = "force-dynamic";

export async function GET(
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

  const authz = authorize(ctx, PERMISSIONS.SURVEY_ANALYTICS_READ, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "survey",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const survey = await prisma.survey.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId: id, tenantId: ctx.tenantId },
  });

  const analytics = aggregateSurveyAnalytics(
    {
      id: survey.id,
      questions: (survey.questions as any) as SurveyQuestion[],
    },
    responses.map((r) => ({
      answers: (r.answers as any) || [],
      npsScore: r.npsScore,
    }))
  );

  return NextResponse.json({
    data: {
      survey: {
        id: survey.id,
        title: survey.title,
        category: survey.category,
        isAnonymous: survey.isAnonymous,
        status: survey.status,
      },
      analytics,
    },
  });
}
