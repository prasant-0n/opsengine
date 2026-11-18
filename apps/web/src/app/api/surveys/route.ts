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

  const authz = authorize(ctx, PERMISSIONS.SURVEY_RESPOND, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "survey",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  const whereClause: any = { tenantId: ctx.tenantId };
  if (category) {
    whereClause.category = category;
  }
  if (status) {
    whereClause.status = status;
  }

  const surveys = await prisma.survey.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: surveys });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.SURVEY_MANAGE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "survey",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      title,
      description,
      category = "pulse",
      isAnonymous = true,
      questions = [],
      startsAt,
      endsAt,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Survey title is required." }, { status: 400 });
    }

    const survey = await prisma.survey.create({
      data: {
        tenantId: ctx.tenantId,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        category: String(category).trim().toLowerCase(),
        status: "active",
        isAnonymous: Boolean(isAnonymous),
        questions: Array.isArray(questions) ? questions : [],
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });

    return NextResponse.json({ data: survey }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create survey" },
      { status: 500 }
    );
  }
}
