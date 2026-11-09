/**
 * Load Testing & Concurrency Benchmark Engine
 * PRD §14.1 (Availability and Performance) & Phase 6
 */

export interface LatencyStats {
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface SlaEvaluation {
  passed: boolean;
  targetP95Ms: number;
  achievedP95Ms: number;
  targetErrorRate: number;
  achievedErrorRate: number;
  violations: string[];
}

export interface RequestMetric {
  durationMs: number;
  statusCode: number;
  endpoint: string;
  tenantId?: string;
  error?: string;
}

export class LatencyCalculator {
  /**
   * Computes accurate percentile and quantile distributions from latency array
   */
  public static compute(latencies: number[]): LatencyStats {
    if (!latencies || latencies.length === 0) {
      return {
        minMs: 0,
        maxMs: 0,
        meanMs: 0,
        p50Ms: 0,
        p90Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    const getPercentile = (p: number): number => {
      if (n === 1) return sorted[0];
      const rank = (p / 100) * (n - 1);
      const low = Math.floor(rank);
      const high = Math.ceil(rank);
      const weight = rank - low;
      return sorted[low] * (1 - weight) + sorted[high] * weight;
    };

    return {
      minMs: Number(sorted[0].toFixed(2)),
      maxMs: Number(sorted[n - 1].toFixed(2)),
      meanMs: Number((sum / n).toFixed(2)),
      p50Ms: Number(getPercentile(50).toFixed(2)),
      p90Ms: Number(getPercentile(90).toFixed(2)),
      p95Ms: Number(getPercentile(95).toFixed(2)),
      p99Ms: Number(getPercentile(99).toFixed(2)),
    };
  }
}

export class ConcurrentExecutor {
  /**
   * Executes a collection of items across a bounded pool of concurrent workers
   */
  public static async runPool<T, R>(
    items: T[],
    concurrency: number,
    workerFn: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    if (!items.length) return [];
    const poolSize = Math.max(1, Math.min(concurrency, items.length));
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;
        results[currentIndex] = await workerFn(items[currentIndex], currentIndex);
      }
    };

    const workers = Array.from({ length: poolSize }, () => worker());
    await Promise.all(workers);
    return results;
  }
}

export class SlaValidator {
  /**
   * Evaluates metrics against PRD §14.1 SLA standards:
   * Core Reads P95 < 300ms, Error rate < 1% (excluding 429)
   */
  public static evaluate(
    stats: LatencyStats,
    errorCount: number,
    totalRequests: number,
    options?: { targetP95Ms?: number; targetMaxErrorRate?: number }
  ): SlaEvaluation {
    const targetP95 = options?.targetP95Ms ?? 300;
    const targetErrorRate = options?.targetMaxErrorRate ?? 0.01;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
    const violations: string[] = [];

    if (stats.p95Ms > targetP95) {
      violations.push(
        `P95 latency SLA breached: achieved ${stats.p95Ms}ms exceeds target ${targetP95}ms`
      );
    }

    if (errorRate > targetErrorRate) {
      violations.push(
        `Error rate SLA breached: achieved ${(errorRate * 100).toFixed(2)}% exceeds target ${(targetErrorRate * 100).toFixed(2)}%`
      );
    }

    return {
      passed: violations.length === 0,
      targetP95Ms: targetP95,
      achievedP95Ms: stats.p95Ms,
      targetErrorRate,
      achievedErrorRate: Number(errorRate.toFixed(4)),
      violations,
    };
  }
}
