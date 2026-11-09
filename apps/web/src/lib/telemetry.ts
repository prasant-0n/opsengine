import {
  parseTraceparent,
  formatTraceparent,
  generateTraceId,
  generateSpanId,
  recordHttpRequest,
  type TraceContext,
} from "@opsengine/telemetry";
import { createLogger, Logger } from "@opsengine/logger";

export interface RequestTelemetryContext {
  traceId: string;
  spanId: string;
  traceparent: string;
  logger: Logger;
  startTime: number;
}

/**
 * Extracts W3C TraceContext from incoming Request or Headers.
 * Falls back to x-trace-id or generates a fresh compliant trace context.
 */
export function initializeRequestTelemetry(
  req: Request,
  tenantId = "none",
  userId = "anonymous"
): RequestTelemetryContext {
  const headerTraceparent = req.headers.get("traceparent");
  const parsed = parseTraceparent(headerTraceparent);

  const traceId = parsed?.traceId || req.headers.get("x-trace-id") || generateTraceId();
  const spanId = generateSpanId();
  const traceparent = formatTraceparent(traceId, spanId, true);

  const requestLogger = createLogger("opsengine-web", {
    traceId,
    spanId,
    tenantId,
    userId,
    url: req.url,
    method: req.method,
  });

  return {
    traceId,
    spanId,
    traceparent,
    logger: requestLogger,
    startTime: performance.now(),
  };
}

/**
 * Injects W3C traceparent and x-trace-id headers into an outgoing Response and records Prometheus metrics.
 */
export function finalizeResponseTelemetry(
  ctx: RequestTelemetryContext,
  res: Response,
  options?: {
    route?: string;
    method?: string;
    tenantId?: string;
  }
): Response {
  const durationSeconds = (performance.now() - ctx.startTime) / 1000;
  const durationMs = Number((durationSeconds * 1000).toFixed(2));

  // 1. Inject distributed tracing response headers
  res.headers.set("traceparent", ctx.traceparent);
  res.headers.set("x-trace-id", ctx.traceId);

  // 2. Record Prometheus metrics
  try {
    recordHttpRequest(
      options?.method || "GET",
      options?.route || "unknown",
      res.status,
      options?.tenantId || "none",
      durationSeconds
    );
  } catch {
    // Non-blocking telemetry recording
  }

  // 3. Emit structured JSON access log
  ctx.logger.info("HTTP request completed", {
    status: res.status,
    latency_ms: durationMs,
    route: options?.route,
  });

  return res;
}
