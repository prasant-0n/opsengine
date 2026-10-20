import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAssistantAuthz, isResponse } from "../_lib";
import { isTenantAiEnabled } from "@/features/assistant/lib/assistant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAssistantAuthz(PERMISSIONS.ASSISTANT_USE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const aiEnabled = await isTenantAiEnabled(ctx.tenantId);
  return NextResponse.json({ aiEnabled, tenantId: ctx.tenantId });
}
