import { NextRequest, NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/auth/portal-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  return NextResponse.json({
    data: {
      tenantId: auth.ctx.tenantId,
      account: {
        id: auth.ctx.accountId,
        name: auth.ctx.accountName,
      },
      user: {
        id: auth.ctx.userId,
        contactId: auth.ctx.contactId,
        name: auth.ctx.contactName,
        email: auth.ctx.contactEmail,
        isStaff: auth.ctx.isStaff,
      },
    },
  });
}
