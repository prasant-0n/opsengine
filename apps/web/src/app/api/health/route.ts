import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initializeRequestTelemetry, finalizeResponseTelemetry } from "@/lib/telemetry";
import { recordDbQuery } from "@opsengine/telemetry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const telemetry = initializeRequestTelemetry(req);
  const dbStart = performance.now();
  let dbStatus = "connected";
  let latencyMs = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbDurationSec = (performance.now() - dbStart) / 1000;
    latencyMs = Math.round(dbDurationSec * 1000);
    recordDbQuery("health_check_ping", dbDurationSec);
  } catch {
    dbStatus = "disconnected";
  }

  const memory = process.memoryUsage();
  const isHealthy = dbStatus === "connected";

  const res = NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      traceId: telemetry.traceId,
      database: {
        status: dbStatus,
        latencyMs,
      },
      system: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
      version: process.env.APP_VERSION || "1.46.2",
    },
    { status: isHealthy ? 200 : 503 }
  );

  return finalizeResponseTelemetry(telemetry, res, {
    route: "/api/health",
    method: "GET",
    tenantId: "system",
  });
}
