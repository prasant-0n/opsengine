import { NextRequest, NextResponse } from "next/server";
import { globalAiGuardrailEngine } from "@/lib/ai-guardrails";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId parameter is required" },
        { status: 400 }
      );
    }

    const userId = body.userId || "usr-anonymous";
    const userPermissions: string[] = Array.isArray(body.userPermissions)
      ? body.userPermissions
      : [];
    const prompt: string = body.prompt;

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required in request body" },
        { status: 400 }
      );
    }

    const requestedTools = body.requestedTools || [];

    const response = await globalAiGuardrailEngine.executePrompt(
      tenantId,
      userId,
      userPermissions,
      prompt,
      requestedTools
    );

    return NextResponse.json({
      ...response,
    });
  } catch (err: any) {
    const isSecurityError =
      err?.message?.includes("violates security policy") ||
      err?.message?.includes("Access Denied") ||
      err?.message?.includes("Security Policy Violation");

    return NextResponse.json(
      { error: err?.message || "AI execution failed" },
      { status: isSecurityError ? 403 : 500 }
    );
  }
}
