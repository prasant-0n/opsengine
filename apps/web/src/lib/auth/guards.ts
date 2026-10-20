import { authorize, type AuthorizationContext, type DecisionResource } from "@/lib/permissions";
import type { NextRequest } from "next/server";

export async function requireAuth(
  _req: NextRequest,
  action: string,
  resource?: DecisionResource | null,
): Promise<{ ctx: AuthorizationContext; auth: ReturnType<typeof authorize> }> {
  const token = await (await import("@/lib/auth/session-cookie")).getSessionToken();
  if (!token) {
    throw new Error("NOT_AUTHENTICATED");
  }
  const ctx = await (await import("@/lib/permissions")).buildAuthContext(token);
  if (!ctx) throw new Error("NOT_AUTHENTICATED");
  const auth = authorize(ctx, action, resource ?? { tenantId: ctx.tenantId });
  if (!auth.allowed) throw new Error("FORBIDDEN");
  return { ctx, auth };
}
