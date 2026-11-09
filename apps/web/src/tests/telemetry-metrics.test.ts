import { describe, it, expect, beforeEach } from "vitest";
import {
  generateTraceId,
  generateSpanId,
  parseTraceparent,
  formatTraceparent,
  withSpan,
  Span,
  Counter,
  Gauge,
  Histogram,
  MetricRegistry,
  defaultRegistry,
  recordHttpRequest,
  recordRebacDecision,
  opsengineMetrics,
} from "@opsengine/telemetry";
import { createLogger, sanitizeMetadata } from "@opsengine/logger";
import { GET as getMetrics } from "../app/api/metrics/route";
import { GET as getHealth } from "../app/api/health/route";

describe("Observability & Telemetry Engine (PRD §7.3 & §21)", () => {
  beforeEach(() => {
    defaultRegistry.resetAll();
  });

  describe("1. W3C TraceContext Distributed Tracing", () => {
    it("generates compliant 32-character traceId and 16-character spanId", () => {
      const traceId = generateTraceId();
      const spanId = generateSpanId();

      expect(traceId).toHaveLength(32);
      expect(traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(traceId).not.toBe("0".repeat(32));

      expect(spanId).toHaveLength(16);
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(spanId).not.toBe("0".repeat(16));
    });

    it("parses valid W3C traceparent headers", () => {
      const header = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
      const parsed = parseTraceparent(header);

      expect(parsed).not.toBeNull();
      expect(parsed?.version).toBe("00");
      expect(parsed?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
      expect(parsed?.parentId).toBe("00f067aa0ba902b7");
      expect(parsed?.traceFlags).toBe("01");
      expect(parsed?.isSampled).toBe(true);
    });

    it("rejects invalid, malformed, or all-zero traceparent headers", () => {
      expect(parseTraceparent(null)).toBeNull();
      expect(parseTraceparent("")).toBeNull();
      expect(parseTraceparent("invalid-header")).toBeNull();
      // all zero trace ID
      expect(
        parseTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01")
      ).toBeNull();
      // all zero span ID
      expect(
        parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01")
      ).toBeNull();
      // unsupported version ff
      expect(
        parseTraceparent("ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
      ).toBeNull();
    });

    it("formats compliant W3C traceparent headers", () => {
      const formatted = formatTraceparent("4bf92f3577b34da6a3ce929d0e0e4736", "00f067aa0ba902b7", true);
      expect(formatted).toBe("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");

      const unsampled = formatTraceparent("4bf92f3577b34da6a3ce929d0e0e4736", "00f067aa0ba902b7", false);
      expect(unsampled).toBe("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00");
    });

    it("manages Span lifecycle with duration, attributes, and status", async () => {
      const span = new Span("test.operation", "trace123", "span456");
      span.setAttribute("tenant.id", "t-1");
      span.setAttribute("user.id", "u-1");
      span.addEvent("cache_miss", { key: "user:profile" });

      expect(span.name).toBe("test.operation");
      expect(span.attributes["tenant.id"]).toBe("t-1");
      expect(span.events).toHaveLength(1);

      span.end();
      expect(span.status).toBe("OK");
      expect(span.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("withSpan executes async operations and records errors on rejection", async () => {
      let executedSpan: Span | undefined;

      await expect(
        withSpan("failing.action", async (span) => {
          executedSpan = span;
          span.setAttribute("step", "init");
          throw new Error("Simulated database failure");
        })
      ).rejects.toThrow("Simulated database failure");

      expect(executedSpan).toBeDefined();
      expect(executedSpan?.status).toBe("ERROR");
      expect(executedSpan?.error?.message).toBe("Simulated database failure");
    });
  });

  describe("2. Prometheus Metrics Registry & Primitives", () => {
    it("handles Counter increments with multiple label dimensions", () => {
      const registry = new MetricRegistry();
      const counter = registry.counter("test_counter", "Test counter help");

      counter.inc({ method: "GET", status: "200" });
      counter.inc({ method: "GET", status: "200" }, 2);
      counter.inc({ method: "POST", status: "201" });

      expect(counter.get({ method: "GET", status: "200" })).toBe(3);
      expect(counter.get({ method: "POST", status: "201" })).toBe(1);
      expect(counter.get({ method: "DELETE", status: "404" })).toBe(0);

      const formatted = counter.format();
      expect(formatted).toContain("# TYPE test_counter counter");
      expect(formatted).toContain('test_counter{method="GET",status="200"} 3');
      expect(formatted).toContain('test_counter{method="POST",status="201"} 1');
    });

    it("handles Gauge set, inc, and dec operations", () => {
      const registry = new MetricRegistry();
      const gauge = registry.gauge("active_connections", "Active connection count");

      gauge.set(10, { pool: "primary" });
      expect(gauge.get({ pool: "primary" })).toBe(10);

      gauge.inc({ pool: "primary" }, 5);
      expect(gauge.get({ pool: "primary" })).toBe(15);

      gauge.dec({ pool: "primary" }, 3);
      expect(gauge.get({ pool: "primary" })).toBe(12);

      const formatted = gauge.format();
      expect(formatted).toContain("# TYPE active_connections gauge");
      expect(formatted).toContain('active_connections{pool="primary"} 12');
    });

    it("observes values in Histogram and computes bucket counts", () => {
      const registry = new MetricRegistry();
      const hist = registry.histogram("request_latency", "Latency in seconds", [0.01, 0.05, 0.1, 1]);

      hist.observe(0.005, { route: "/api/health" });
      hist.observe(0.04, { route: "/api/health" });
      hist.observe(0.5, { route: "/api/health" });

      const state = hist.get({ route: "/api/health" });
      expect(state?.count).toBe(3);
      expect(state?.sum).toBeCloseTo(0.545, 3);
      expect(state?.bucketCounts[0]).toBe(1); // <= 0.01
      expect(state?.bucketCounts[1]).toBe(2); // <= 0.05
      expect(state?.bucketCounts[2]).toBe(2); // <= 0.1
      expect(state?.bucketCounts[3]).toBe(3); // <= 1

      const formatted = hist.format();
      expect(formatted).toContain('request_latency_bucket{le="0.01",route="/api/health"} 1');
      expect(formatted).toContain('request_latency_bucket{le="+Inf",route="/api/health"} 3');
      expect(formatted).toContain('request_latency_count{route="/api/health"} 3');
    });

    it("formats standard Prometheus exposition for multiple metrics", () => {
      const registry = new MetricRegistry();
      registry.counter("app_requests", "Total requests").inc({ status: "200" });
      registry.gauge("app_memory", "Memory bytes").set(1024);

      const output = registry.exportPrometheus();
      expect(output).toContain("# HELP app_requests Total requests");
      expect(output).toContain("# TYPE app_requests counter");
      expect(output).toContain("# HELP app_memory Memory bytes");
      expect(output).toContain("# TYPE app_memory gauge");
    });
  });

  describe("3. Structured JSON Logging & Masking", () => {
    it("sanitizes sensitive parameters in metadata payloads", () => {
      const sensitive = {
        username: "admin",
        password: "SuperSecretPassword123!",
        token: "jwt-token-xyz",
        nested: {
          apiKey: "sk-12345",
          safeField: "safeValue",
        },
      };

      const sanitized = sanitizeMetadata(sensitive);
      expect(sanitized.username).toBe("admin");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.nested.apiKey).toBe("[REDACTED]");
      expect(sanitized.nested.safeField).toBe("safeValue");
    });

    it("creates structured log records with correlation attributes", () => {
      const logger = createLogger("test-service", {
        traceId: "trace-abc",
        tenantId: "tenant-xyz",
      });

      const record = logger.info("User logged in successfully", {
        userId: "user-1",
        ip: "127.0.0.1",
      });

      expect(record.service).toBe("test-service");
      expect(record.level).toBe("INFO");
      expect(record.trace_id).toBe("trace-abc");
      expect(record.tenant_id).toBe("tenant-xyz");
      expect(record.message).toBe("User logged in successfully");
      expect(record.metadata?.userId).toBe("user-1");
    });
  });

  describe("4. Endpoints & ReBAC Telemetry Integration", () => {
    it("exposes Prometheus metrics endpoint at /api/metrics", async () => {
      recordHttpRequest("GET", "/api/tickets", 200, "tenant-a", 0.045);
      recordRebacDecision("tenant-a", "ALLOW", "ticket:read");
      recordRebacDecision("tenant-a", "DENY", "invoice:delete");

      const response = await getMetrics();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");

      const text = await response.text();
      expect(text).toContain("opsengine_http_requests_total");
      expect(text).toContain('method="GET"');
      expect(text).toContain('route="/api/tickets"');
      expect(text).toContain("opsengine_rebac_decisions_total");
      expect(text).toContain('decision="ALLOW"');
      expect(text).toContain('decision="DENY"');
      expect(text).toContain("opsengine_system_uptime_seconds");
    });

    it("propagates W3C traceparent and x-trace-id headers in health check response", async () => {
      const incomingTrace = "00-a1b2c3d4e5f60718293a4b5c6d7e8f90-1234567890abcdef-01";
      const req = new Request("http://localhost:3000/api/health", {
        headers: {
          traceparent: incomingTrace,
        },
      });

      const res = await getHealth(req);
      expect(res.status).toBe(200);

      const resTraceparent = res.headers.get("traceparent");
      const resTraceId = res.headers.get("x-trace-id");

      expect(resTraceId).toBe("a1b2c3d4e5f60718293a4b5c6d7e8f90");
      expect(resTraceparent).toContain("00-a1b2c3d4e5f60718293a4b5c6d7e8f90-");

      const json = await res.json();
      expect(json.status).toBe("healthy");
      expect(json.traceId).toBe("a1b2c3d4e5f60718293a4b5c6d7e8f90");
    });
  });
});
