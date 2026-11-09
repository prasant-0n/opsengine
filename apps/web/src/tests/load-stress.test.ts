import { describe, it, expect } from "vitest";
import {
  LatencyCalculator,
  ConcurrentExecutor,
  SlaValidator,
} from "../lib/testing/load-benchmark";

describe("High-Throughput Load Testing & Concurrency Stress Suite (PRD §14.1 & Phase 6)", () => {
  describe("1. Latency Percentile & Quantile Distribution Calculator", () => {
    it("handles empty latency collections gracefully", () => {
      const stats = LatencyCalculator.compute([]);
      expect(stats.minMs).toBe(0);
      expect(stats.maxMs).toBe(0);
      expect(stats.p50Ms).toBe(0);
      expect(stats.p95Ms).toBe(0);
    });

    it("accurately computes Min, Mean, Median (P50), P90, P95, and P99 on linear distributions", () => {
      // 100 values from 1ms to 100ms
      const latencies = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = LatencyCalculator.compute(latencies);

      expect(stats.minMs).toBe(1);
      expect(stats.maxMs).toBe(100);
      expect(stats.meanMs).toBe(50.5);
      expect(stats.p50Ms).toBe(50.5);
      expect(stats.p90Ms).toBe(90.1);
      expect(stats.p95Ms).toBe(95.05);
      expect(stats.p99Ms).toBe(99.01);
    });

    it("correctly identifies long-tail latency outliers in skewed distributions", () => {
      // 95 fast requests (10ms) and 5 slow outliers (500ms)
      const latencies = [
        ...Array.from({ length: 95 }, () => 10),
        ...Array.from({ length: 5 }, () => 500),
      ];

      const stats = LatencyCalculator.compute(latencies);

      expect(stats.minMs).toBe(10);
      expect(stats.p50Ms).toBe(10);
      expect(stats.p90Ms).toBe(10);
      // P95 and above reflect the tail jump
      expect(stats.p95Ms).toBeGreaterThanOrEqual(10);
      expect(stats.p99Ms).toBe(500);
      expect(stats.maxMs).toBe(500);
    });
  });

  describe("2. Concurrent Worker Pool Executor", () => {
    it("enforces maximum concurrency pool limit and processes all tasks", async () => {
      const totalTasks = 30;
      const maxConcurrency = 5;
      let activeConcurrency = 0;
      let peakConcurrency = 0;

      const tasks = Array.from({ length: totalTasks }, (_, i) => i);

      const results = await ConcurrentExecutor.runPool(
        tasks,
        maxConcurrency,
        async (taskIndex) => {
          activeConcurrency++;
          if (activeConcurrency > peakConcurrency) {
            peakConcurrency = activeConcurrency;
          }

          // Simulate brief async I/O
          await new Promise((resolve) => setTimeout(resolve, 10));

          activeConcurrency--;
          return taskIndex * 2;
        }
      );

      expect(results.length).toBe(totalTasks);
      expect(peakConcurrency).toBeLessThanOrEqual(maxConcurrency);
      expect(results[0]).toBe(0);
      expect(results[29]).toBe(58);
    });

    it("handles empty task lists safely without hanging", async () => {
      const results = await ConcurrentExecutor.runPool([], 10, async (x) => x);
      expect(results).toEqual([]);
    });
  });

  describe("3. PRD §14.1 SLA Validation Engine", () => {
    it("passes SLA when P95 latency is below 300ms and error rate is below 1%", () => {
      const stats = {
        minMs: 5,
        maxMs: 120,
        meanMs: 25,
        p50Ms: 20,
        p90Ms: 45,
        p95Ms: 65, // Well below 300ms
        p99Ms: 110,
      };

      const result = SlaValidator.evaluate(stats, 0, 500, { targetP95Ms: 300 });

      expect(result.passed).toBe(true);
      expect(result.achievedP95Ms).toBe(65);
      expect(result.violations).toHaveLength(0);
    });

    it("fails SLA when P95 latency breaches 300ms SLA target", () => {
      const stats = {
        minMs: 50,
        maxMs: 850,
        meanMs: 220,
        p50Ms: 180,
        p90Ms: 290,
        p95Ms: 345, // Breaches 300ms!
        p99Ms: 780,
      };

      const result = SlaValidator.evaluate(stats, 0, 500, { targetP95Ms: 300 });

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain("P95 latency SLA breached");
    });

    it("fails SLA when error rate exceeds 1% threshold", () => {
      const stats = {
        minMs: 5,
        maxMs: 50,
        meanMs: 15,
        p50Ms: 12,
        p90Ms: 22,
        p95Ms: 30,
        p99Ms: 45,
      };

      // 10 errors out of 100 requests = 10% error rate
      const result = SlaValidator.evaluate(stats, 10, 100, {
        targetP95Ms: 300,
        targetMaxErrorRate: 0.01,
      });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes("Error rate SLA breached"))).toBe(true);
    });
  });

  describe("4. Multi-Tenant Concurrency Burst Simulation", () => {
    it("partitions concurrent request streams across isolated tenant identities", async () => {
      const tenants = ["tenant-alpha", "tenant-bravo", "tenant-charlie"];
      const totalRequests = 60;
      const requests = Array.from({ length: totalRequests }, (_, i) => ({
        id: i,
        tenantId: tenants[i % tenants.length],
      }));

      const tenantCounters = new Map<string, number>();

      await ConcurrentExecutor.runPool(requests, 10, async (req) => {
        const count = tenantCounters.get(req.tenantId) || 0;
        tenantCounters.set(req.tenantId, count + 1);
        return req.tenantId;
      });

      // Verify uniform concurrency distribution
      expect(tenantCounters.get("tenant-alpha")).toBe(20);
      expect(tenantCounters.get("tenant-bravo")).toBe(20);
      expect(tenantCounters.get("tenant-charlie")).toBe(20);
    });
  });
});
