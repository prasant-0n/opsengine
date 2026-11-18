import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.ERP_SYNC_READ, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "erp_integration",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const integrations = await prisma.erpIntegration.findMany({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      tenantId: true,
      provider: true,
      status: true,
      realmId: true,
      coaMapping: true,
      lastSyncAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: integrations });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.ERP_CONFIG_MANAGE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "erp_integration",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { provider, realmId, coaMapping, accessToken, refreshToken } = body;

    if (!provider || !["quickbooks", "xero"].includes(provider)) {
      return NextResponse.json(
        { error: 'Valid provider ("quickbooks" or "xero") is required.' },
        { status: 400 }
      );
    }

    const integration = await prisma.erpIntegration.upsert({
      where: {
        tenantId_provider: {
          tenantId: ctx.tenantId,
          provider,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        provider,
        status: "connected",
        realmId: realmId ? String(realmId) : null,
        coaMapping: coaMapping || {},
        accessToken: accessToken ? String(accessToken) : null,
        refreshToken: refreshToken ? String(refreshToken) : null,
      },
      update: {
        status: "connected",
        realmId: realmId !== undefined ? (realmId ? String(realmId) : null) : undefined,
        coaMapping: coaMapping !== undefined ? coaMapping : undefined,
        accessToken: accessToken ? String(accessToken) : undefined,
        refreshToken: refreshToken ? String(refreshToken) : undefined,
        lastError: null,
      },
    });

    return NextResponse.json(
      {
        message: `Successfully connected ${provider === "quickbooks" ? "QuickBooks Online" : "Xero"}.`,
        data: {
          id: integration.id,
          provider: integration.provider,
          status: integration.status,
          realmId: integration.realmId,
          coaMapping: integration.coaMapping,
          updatedAt: integration.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to configure ERP integration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
