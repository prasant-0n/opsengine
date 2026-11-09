#!/usr/bin/env tsx
/**
 * Automated High-Throughput Load Testing & Concurrency Benchmark Harness
 * Conforms directly to PRD §14.1 (Availability and Performance) & Phase 6
 *
 * Usage:
 *   npx tsx scripts/load-test.ts [--url http://localhost:3001] [--concurrency 25] [--requests 500]
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  LatencyCalculator,
  ConcurrentExecutor,
  SlaValidator,
  RequestMetric,
} from "../apps/web/src/lib/testing/load-benchmark";

interface ScenarioItem {
  id: number;
  path: string;
  method: "GET" | "POST";
  tenantId: string;
  body?: Record<string, unknown>;
}

async function runLoadBenchmark() {
  const args = process.argv.slice(2);
  const getArg = (name: string, fallback: string): string => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
  };

  const baseUrl = getArg("--url", "http://localhost:3001");
  const concurrency = parseInt(getArg("--concurrency", "25"), 10);
  const totalRequests = parseInt(getArg("--requests", "500"), 10);

  console.log("================================================================================");
  console.log("⚡ OpsEngine High-Throughput Load & Concurrency Stress Harness (PRD §14.1)");
  console.log("================================================================================");
  console.log(`Target Base URL   : ${baseUrl}`);
  console.log(`Concurrency Pool  : ${concurrency} virtual workers`);
  console.log(`Total Requests    : ${totalRequests} requests`);
  console.log(`Timestamp         : ${new Date().toISOString()}`);
  console.log("--------------------------------------------------------------------------------\n");

  const tenants = ["tenant-alpha", "tenant-bravo", "tenant-enterprise", "tenant-gamma"];

  // Generate weighted scenario items
  const scenarioItems: ScenarioItem[] = [];
  for (let i = 0; i < totalRequests; i++) {
    const tenantId = tenants[i % tenants.length];
    const rand = Math.random();

    if (rand < 0.40) {
      scenarioItems.push({
        id: i + 1,
        path: "/api/health",
        method: "GET",
        tenantId,
      });
    } else if (rand < 0.65) {
      scenarioItems.push({
        id: i + 1,
        path: "/api/events/outbox",
        method: "GET",
        tenantId,
      });
    } else if (rand < 0.85) {
      scenarioItems.push({
        id: i + 1,
        path: "/api/openapi.json",
        method: "GET",
        tenantId,
      });
    } else {
      scenarioItems.push({
        id: i + 1,
        path: "/api/events/outbox",
        method: "POST",
        tenantId,
        body: {
          action: "publish_demo",
          tenantId,
          payload: { source: "load-test-harness", iteration: i },
        },
      });
    }
  }

  console.log(`🚀 Dispatching ${totalRequests} multi-tenant requests across ${concurrency} workers...`);
  const startTime = performance.now();

  const metrics: RequestMetric[] = await ConcurrentExecutor.runPool(
    scenarioItems,
    concurrency,
    async (item) => {
      const t0 = performance.now();
      try {
        const headers: Record<string, string> = {
          "Accept": "application/json",
          "X-Tenant-Id": item.tenantId,
          "User-Agent": "OpsEngine-LoadTester/1.0",
        };

        if (item.method === "POST") {
          headers["Content-Type"] = "application/json";
        }

        const res = await fetch(`${baseUrl}${item.path}`, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined,
        });

        // Drain body to release socket
        await res.text();
        const durationMs = performance.now() - t0;

        return {
          durationMs,
          statusCode: res.status,
          endpoint: item.path,
          tenantId: item.tenantId,
        };
      } catch (err: any) {
        const durationMs = performance.now() - t0;
        return {
          durationMs,
          statusCode: 0,
          endpoint: item.path,
          tenantId: item.tenantId,
          error: err?.message || "Network Error",
        };
      }
    }
  );

  const totalDurationMs = performance.now() - startTime;
  const durationSeconds = totalDurationMs / 1000;
  const rps = Number((totalRequests / durationSeconds).toFixed(2));

  // Compute status distributions
  let successCount = 0;
  let rateLimitedCount = 0;
  let wafBlockedCount = 0;
  let serverErrors = 0;
  let clientErrors = 0;

  for (const m of metrics) {
    if (m.statusCode >= 200 && m.statusCode < 400) successCount++;
    else if (m.statusCode === 429) rateLimitedCount++;
    else if (m.statusCode === 403) wafBlockedCount++;
    else if (m.statusCode >= 500 || m.statusCode === 0) serverErrors++;
    else clientErrors++;
  }

  // Calculate latency distributions
  const allLatencies = metrics.map((m) => m.durationMs);
  const latencyStats = LatencyCalculator.compute(allLatencies);

  // Evaluate SLA compliance
  const slaResult = SlaValidator.evaluate(latencyStats, serverErrors, totalRequests, {
    targetP95Ms: 300,
  });

  console.log("\n================================================================================");
  console.log("📊 Performance & Throughput Results");
  console.log("================================================================================");
  console.log(`Total Requests      : ${totalRequests}`);
  console.log(`Duration            : ${durationSeconds.toFixed(2)}s`);
  console.log(`Throughput          : ${rps} req/sec`);
  console.log(`HTTP 2xx Success    : ${successCount} (${((successCount / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`HTTP 429 Throttled  : ${rateLimitedCount}`);
  console.log(`HTTP 403 WAF Block  : ${wafBlockedCount}`);
  console.log(`HTTP 5xx Failures   : ${serverErrors}`);
  console.log("--------------------------------------------------------------------------------");
  console.log("⏱️  Latency Distribution (Milliseconds):");
  console.log(`  Min Latency       : ${latencyStats.minMs} ms`);
  console.log(`  Mean Latency      : ${latencyStats.meanMs} ms`);
  console.log(`  P50 (Median)      : ${latencyStats.p50Ms} ms`);
  console.log(`  P90 Percentile    : ${latencyStats.p90Ms} ms`);
  console.log(`  P95 Percentile    : ${latencyStats.p95Ms} ms  (PRD SLA Target: < 300 ms)`);
  console.log(`  P99 Percentile    : ${latencyStats.p99Ms} ms`);
  console.log(`  Max Latency       : ${latencyStats.maxMs} ms`);
  console.log("--------------------------------------------------------------------------------");

  if (slaResult.passed) {
    console.log("✅ PRD §14.1 PERFORMANCE SLA STATUS: PASSED (P95 latency well within 300ms SLA)");
  } else {
    console.log("❌ PRD §14.1 PERFORMANCE SLA STATUS: FAILED");
    slaResult.violations.forEach((v) => console.log(`   - ${v}`));
  }
  console.log("================================================================================\n");

  // Output JSON report file
  const reportDir = join(process.cwd(), "reports");
  mkdirSync(reportDir, { recursive: true });
  const reportFile = join(
    reportDir,
    `load-test-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  const reportPayload = {
    testRunId: `load-test-${Date.now()}`,
    timestamp: new Date().toISOString(),
    configuration: {
      baseUrl,
      concurrency,
      totalRequests,
    },
    summary: {
      totalRequests,
      durationSeconds,
      throughputRps: rps,
      successCount,
      rateLimitedCount,
      wafBlockedCount,
      serverErrors,
    },
    latency: latencyStats,
    slaEvaluation: slaResult,
  };

  writeFileSync(reportFile, JSON.stringify(reportPayload, null, 2), "utf8");
  console.log(`📁 Detailed Load Benchmark Report saved to: ${reportFile}\n`);

  if (!slaResult.passed) {
    process.exit(1);
  }
}

runLoadBenchmark().catch((err) => {
  console.error("Fatal error during load benchmark:", err);
  process.exit(1);
});
