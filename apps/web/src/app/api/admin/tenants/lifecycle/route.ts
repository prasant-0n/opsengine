import { NextRequest, NextResponse } from "next/server";
import {
  globalTenantLifecycleService,
  globalTenantExportEngine,
} from "@/lib/tenancy";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId query parameter is required" },
      { status: 400 }
    );
  }

  const state = globalTenantLifecycleService.getState(tenantId);
  return NextResponse.json({
    tenantId,
    state,
    isQuarantined: globalTenantLifecycleService.isQuarantined(tenantId),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;
    const tenantId = body.tenantId;
    const reason = body.reason;
    const operatorId = body.operatorId || "root-admin";

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    if (action === "quarantine") {
      if (!reason) {
        return NextResponse.json(
          { error: "Mandatory justification reason required to quarantine tenant" },
          { status: 400 }
        );
      }
      const record = globalTenantLifecycleService.quarantine(tenantId, reason, operatorId);
      return NextResponse.json({
        success: true,
        action: "quarantine",
        record,
      });
    }

    if (action === "reinstate") {
      if (!reason) {
        return NextResponse.json(
          { error: "Mandatory justification reason required to reinstate tenant" },
          { status: 400 }
        );
      }
      const record = globalTenantLifecycleService.reinstate(tenantId, reason, operatorId);
      return NextResponse.json({
        success: true,
        action: "reinstate",
        record,
      });
    }

    if (action === "offboard") {
      const record = globalTenantLifecycleService.offboard(tenantId, reason || "Tenant offboarded", operatorId);
      return NextResponse.json({
        success: true,
        action: "offboard",
        record,
      });
    }

    if (action === "purge") {
      if (!reason) {
        return NextResponse.json(
          { error: "Mandatory justification reason required for cryptographic purge" },
          { status: 400 }
        );
      }
      const receipt = globalTenantExportEngine.executePurge(tenantId, operatorId, reason);
      return NextResponse.json({
        success: true,
        action: "purge",
        receipt,
      });
    }

    return NextResponse.json(
      { error: `Unknown lifecycle action '${action}'. Valid actions: 'quarantine', 'reinstate', 'offboard', 'purge'` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process tenant lifecycle action", details: err?.message },
      { status: 500 }
    );
  }
}
