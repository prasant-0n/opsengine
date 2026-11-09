import { NextRequest, NextResponse } from "next/server";
import { globalTenantExportEngine } from "@/lib/tenancy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required to generate data export" },
        { status: 400 }
      );
    }

    const bundle = globalTenantExportEngine.generateExportBundle(tenantId, {
      tenantName: body.tenantName,
      includeAuditTrail: body.includeAuditTrail !== false,
      ttlDays: body.ttlDays,
    });

    return NextResponse.json({
      success: true,
      exportId: bundle.manifest.exportId,
      manifest: bundle.manifest,
      downloadUrl: `/api/admin/tenants/export?exportId=${bundle.manifest.exportId}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to generate tenant export bundle", details: err?.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const exportId = searchParams.get("exportId");

    if (!exportId) {
      return NextResponse.json(
        { error: "exportId query parameter is required" },
        { status: 400 }
      );
    }

    const requestingTenantId = req.headers.get("x-tenant-id") || "*";
    const bundle = globalTenantExportEngine.getExportBundle(exportId, requestingTenantId);

    return new Response(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="tenant-export-${bundle.manifest.tenantId}-${exportId}.json"`,
        "X-Checksum-SHA256": bundle.manifest.checksumSha256,
        "X-Entity-Counts": JSON.stringify(bundle.manifest.entityCounts),
      },
    });
  } catch (err: any) {
    const isForbidden = err?.message?.includes("Cross-tenant");
    const isNotFound = err?.message?.includes("not found");
    const status = isForbidden ? 403 : isNotFound ? 404 : 500;

    return NextResponse.json(
      { error: err?.message || "Failed to retrieve export archive" },
      { status }
    );
  }
}
