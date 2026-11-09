import { NextRequest, NextResponse } from "next/server";
import { ToolRegistry } from "@/lib/ai-guardrails";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const permissionsParam = searchParams.get("permissions");
    const userPermissions = permissionsParam ? permissionsParam.split(",") : undefined;

    const tools = ToolRegistry.listTools(userPermissions);

    return NextResponse.json({
      success: true,
      total: tools.length,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
        type: t.type,
        requiredPermission: t.requiredPermission,
        requiresHumanConfirmation: t.requiresHumanConfirmation,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to list tools", details: err?.message },
      { status: 500 }
    );
  }
}
