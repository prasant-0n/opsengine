import { NextResponse } from "next/server";
import { defaultRegistry, updateSystemMetrics, opsengineMetrics } from "@opsengine/telemetry";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Update runtime system metrics (memory, uptime)
    updateSystemMetrics();

    // 2. Refresh active tenant workspaces gauge from database
    try {
      const workspaceCounts: Array<{ lifecycle_status: string; count: bigint }> = await prisma.$queryRaw`
        SELECT lifecycle_status, COUNT(*) as count 
        FROM tenant_workspaces 
        GROUP BY lifecycle_status
      `;

      for (const row of workspaceCounts) {
        opsengineMetrics.activeWorkspacesGauge.set(
          Number(row.count),
          { lifecycle_status: row.lifecycle_status }
        );
      }
    } catch {
      // If DB is temporarily unreachable during metrics scrape, retain last observed metrics
    }

    // 3. Export standard OpenMetrics / Prometheus plaintext
    const exposition = defaultRegistry.exportPrometheus();

    return new Response(exposition, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Metrics exposition error", message: err.message },
      { status: 500 }
    );
  }
}
