import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  getTenantWorkspacesPortfolio,
  provisionTenant,
} from "@/features/control-plane/lib/control-plane-service";

export const dynamic = "force-dynamic";

async function verifyOperator(token: string | null) {
  if (!token) return null;
  const ctx = await buildAuthContext(token);
  if (!ctx) return null;

  const user = await prisma.authUser.findUnique({
    where: { id: ctx.userId },
  });

  const authz = authorize(ctx, PERMISSIONS.CONTROL_PLANE_READ, { tenantId: ctx.tenantId });
  if (!user?.isSuperadmin && !user?.isRootAdmin && !authz.allowed) {
    return null;
  }

  return { ctx, user };
}

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  const operator = await verifyOperator(token);
  if (!operator) {
    return NextResponse.json({ error: "Unauthorized platform operator" }, { status: 403 });
  }

  try {
    const data = await getTenantWorkspacesPortfolio();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load workspaces portfolio" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  const operator = await verifyOperator(token);
  if (!operator) {
    return NextResponse.json({ error: "Unauthorized platform operator" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const result = await provisionTenant(operator.ctx.userId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to provision tenant workspace" },
      { status: 400 }
    );
  }
}
