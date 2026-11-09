import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = performance.now();
  let dbStatus = "connected";
  let latencyMs = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Math.round(performance.now() - start);
  } catch {
    dbStatus = "disconnected";
  }

  const memory = process.memoryUsage();
  const isHealthy = dbStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs,
      },
      system: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
      version: "1.0.0",
    },
    { status: isHealthy ? 200 : 503 }
  );
}
