export type MetricType = "counter" | "gauge" | "histogram";

export interface Metric {
  name: string;
  help: string;
  type: MetricType;
  format(): string;
  reset(): void;
}

function serializeLabels(labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) {
    return "";
  }
  const pairs = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      const sanitized = String(v)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
      return `${k}="${sanitized}"`;
    });
  return `{${pairs.join(",")}}`;
}

function mergeLabels(base?: Record<string, string>, extra?: Record<string, string>): Record<string, string> {
  return { ...(base || {}), ...(extra || {}) };
}

export class Counter implements Metric {
  public readonly name: string;
  public readonly help: string;
  public readonly type: MetricType = "counter";
  private values = new Map<string, { value: number; labels?: Record<string, string> }>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  public inc(labels?: Record<string, string>, amount = 1): void {
    if (amount < 0) {
      throw new Error(`Counter cannot be decremented: ${amount}`);
    }
    const key = serializeLabels(labels);
    const existing = this.values.get(key) || { value: 0, labels };
    existing.value += amount;
    this.values.set(key, existing);
  }

  public get(labels?: Record<string, string>): number {
    const key = serializeLabels(labels);
    return this.values.get(key)?.value || 0;
  }

  public reset(): void {
    this.values.clear();
  }

  public format(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} ${this.type}`,
    ];

    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const { value, labels } of this.values.values()) {
        lines.push(`${this.name}${serializeLabels(labels)} ${value}`);
      }
    }
    return lines.join("\n");
  }
}

export class Gauge implements Metric {
  public readonly name: string;
  public readonly help: string;
  public readonly type: MetricType = "gauge";
  private values = new Map<string, { value: number; labels?: Record<string, string> }>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  public set(value: number, labels?: Record<string, string>): void {
    const key = serializeLabels(labels);
    this.values.set(key, { value, labels });
  }

  public inc(labels?: Record<string, string>, amount = 1): void {
    const key = serializeLabels(labels);
    const existing = this.values.get(key) || { value: 0, labels };
    existing.value += amount;
    this.values.set(key, existing);
  }

  public dec(labels?: Record<string, string>, amount = 1): void {
    const key = serializeLabels(labels);
    const existing = this.values.get(key) || { value: 0, labels };
    existing.value -= amount;
    this.values.set(key, existing);
  }

  public get(labels?: Record<string, string>): number {
    const key = serializeLabels(labels);
    return this.values.get(key)?.value || 0;
  }

  public reset(): void {
    this.values.clear();
  }

  public format(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} ${this.type}`,
    ];

    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const { value, labels } of this.values.values()) {
        lines.push(`${this.name}${serializeLabels(labels)} ${value}`);
      }
    }
    return lines.join("\n");
  }
}

export interface HistogramBucketState {
  bucketCounts: number[];
  sum: number;
  count: number;
  labels?: Record<string, string>;
}

export class Histogram implements Metric {
  public readonly name: string;
  public readonly help: string;
  public readonly type: MetricType = "histogram";
  public readonly buckets: number[];
  private states = new Map<string, HistogramBucketState>();

  constructor(
    name: string,
    help: string,
    buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ) {
    this.name = name;
    this.help = help;
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  public observe(value: number, labels?: Record<string, string>): void {
    const key = serializeLabels(labels);
    let state = this.states.get(key);
    if (!state) {
      state = {
        bucketCounts: new Array(this.buckets.length).fill(0),
        sum: 0,
        count: 0,
        labels,
      };
      this.states.set(key, state);
    }

    state.sum += value;
    state.count += 1;

    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        state.bucketCounts[i] += 1;
      }
    }
  }

  public get(labels?: Record<string, string>): HistogramBucketState | undefined {
    const key = serializeLabels(labels);
    return this.states.get(key);
  }

  public reset(): void {
    this.states.clear();
  }

  public format(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} ${this.type}`,
    ];

    if (this.states.size === 0) {
      for (const b of this.buckets) {
        lines.push(`${this.name}_bucket{le="${b}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
    } else {
      for (const state of this.states.values()) {
        const baseLabels = state.labels || {};
        for (let i = 0; i < this.buckets.length; i++) {
          const bLabels = mergeLabels(baseLabels, { le: String(this.buckets[i]) });
          lines.push(`${this.name}_bucket${serializeLabels(bLabels)} ${state.bucketCounts[i]}`);
        }
        const infLabels = mergeLabels(baseLabels, { le: "+Inf" });
        lines.push(`${this.name}_bucket${serializeLabels(infLabels)} ${state.count}`);
        lines.push(`${this.name}_sum${serializeLabels(baseLabels)} ${state.sum.toFixed(4)}`);
        lines.push(`${this.name}_count${serializeLabels(baseLabels)} ${state.count}`);
      }
    }
    return lines.join("\n");
  }
}

export class MetricRegistry {
  private metrics = new Map<string, Metric>();

  public register(metric: Metric): void {
    this.metrics.set(metric.name, metric);
  }

  public counter(name: string, help: string): Counter {
    let metric = this.metrics.get(name) as Counter;
    if (!metric) {
      metric = new Counter(name, help);
      this.register(metric);
    }
    return metric;
  }

  public gauge(name: string, help: string): Gauge {
    let metric = this.metrics.get(name) as Gauge;
    if (!metric) {
      metric = new Gauge(name, help);
      this.register(metric);
    }
    return metric;
  }

  public histogram(name: string, help: string, buckets?: number[]): Histogram {
    let metric = this.metrics.get(name) as Histogram;
    if (!metric) {
      metric = new Histogram(name, help, buckets);
      this.register(metric);
    }
    return metric;
  }

  public resetAll(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
  }

  public exportPrometheus(): string {
    const chunks: string[] = [];
    for (const metric of this.metrics.values()) {
      chunks.push(metric.format());
    }
    return chunks.join("\n\n") + "\n";
  }
}

// Global default registry instance
export const defaultRegistry = new MetricRegistry();

export const opsengineMetrics = {
  httpRequestsTotal: defaultRegistry.counter(
    "opsengine_http_requests_total",
    "Total count of HTTP requests processed by OpsEngine API"
  ),
  httpRequestDurationSeconds: defaultRegistry.histogram(
    "opsengine_http_request_duration_seconds",
    "Duration of HTTP requests in seconds",
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
  ),
  rebacDecisionsTotal: defaultRegistry.counter(
    "opsengine_rebac_decisions_total",
    "Total count of ReBAC authorization policy decisions evaluated"
  ),
  activeWorkspacesGauge: defaultRegistry.gauge(
    "opsengine_active_workspaces_gauge",
    "Current count of active or suspended tenant workspaces"
  ),
  systemMemoryBytes: defaultRegistry.gauge(
    "opsengine_system_memory_bytes",
    "Node.js memory usage in bytes"
  ),
  systemUptimeSeconds: defaultRegistry.gauge(
    "opsengine_system_uptime_seconds",
    "Total process uptime in seconds"
  ),
  dbQueryDurationSeconds: defaultRegistry.histogram(
    "opsengine_db_query_duration_seconds",
    "Duration of database queries in seconds",
    [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1]
  ),
};

export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  tenantId: string = "none",
  durationSeconds: number
): void {
  const labels = {
    method: method.toUpperCase(),
    route: route || "unknown",
    status: String(status),
    tenant_id: tenantId || "none",
  };
  opsengineMetrics.httpRequestsTotal.inc(labels);
  opsengineMetrics.httpRequestDurationSeconds.observe(durationSeconds, labels);
}

export function recordRebacDecision(
  tenantId: string,
  decision: "ALLOW" | "DENY",
  action: string
): void {
  opsengineMetrics.rebacDecisionsTotal.inc({
    tenant_id: tenantId || "none",
    decision,
    action,
  });
}

export function recordDbQuery(operation: string, durationSeconds: number): void {
  opsengineMetrics.dbQueryDurationSeconds.observe(durationSeconds, {
    operation,
  });
}

export function updateSystemMetrics(): void {
  const mem = process.memoryUsage();
  opsengineMetrics.systemMemoryBytes.set(mem.heapUsed, { type: "heapUsed" });
  opsengineMetrics.systemMemoryBytes.set(mem.heapTotal, { type: "heapTotal" });
  opsengineMetrics.systemMemoryBytes.set(mem.rss, { type: "rss" });
  opsengineMetrics.systemUptimeSeconds.set(Math.round(process.uptime()));
}
