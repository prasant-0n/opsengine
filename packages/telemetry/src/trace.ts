import { randomBytes } from "crypto";

export interface TraceContext {
  version: string;
  traceId: string;
  parentId: string;
  traceFlags: string;
  isSampled: boolean;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

export type SpanStatus = "OK" | "ERROR" | "UNSET";

/**
 * Generates a valid 128-bit W3C Trace ID (32 lowercase hex characters).
 */
export function generateTraceId(): string {
  let id = randomBytes(16).toString("hex");
  while (id === "0".repeat(32)) {
    id = randomBytes(16).toString("hex");
  }
  return id;
}

/**
 * Generates a valid 64-bit W3C Span ID (16 lowercase hex characters).
 */
export function generateSpanId(): string {
  let id = randomBytes(8).toString("hex");
  while (id === "0".repeat(16)) {
    id = randomBytes(8).toString("hex");
  }
  return id;
}

/**
 * Parses a standard W3C traceparent header: 00-{traceId}-{parentId}-{traceFlags}
 */
export function parseTraceparent(header: string | null | undefined): TraceContext | null {
  if (!header || typeof header !== "string") {
    return null;
  }

  const trimmed = header.trim().toLowerCase();
  const match = trimmed.match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
  if (!match) {
    return null;
  }

  const [_, version, traceId, parentId, traceFlags] = match;

  // Invalid versions or all-zero IDs must be rejected per W3C specification
  if (version === "ff" || traceId === "0".repeat(32) || parentId === "0".repeat(16)) {
    return null;
  }

  const flagsNum = parseInt(traceFlags, 16);
  const isSampled = (flagsNum & 1) === 1;

  return {
    version,
    traceId,
    parentId,
    traceFlags,
    isSampled,
  };
}

/**
 * Formats a W3C traceparent header string.
 */
export function formatTraceparent(
  traceId: string,
  spanId: string,
  sampled: boolean = true
): string {
  const flags = sampled ? "01" : "00";
  return `00-${traceId}-${spanId}-${flags}`;
}

/**
 * Lightweight, zero-overhead OpenTelemetry-compatible Span.
 */
export class Span {
  public readonly name: string;
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly parentSpanId?: string;
  public readonly startTime: number;
  public endTime?: number;
  public durationMs?: number;
  public status: SpanStatus = "UNSET";
  public error?: Error;
  public readonly attributes: Record<string, any> = {};
  public readonly events: SpanEvent[] = [];

  constructor(
    name: string,
    traceId: string,
    spanId: string,
    parentSpanId?: string,
    initialAttributes?: Record<string, any>
  ) {
    this.name = name;
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    this.startTime = performance.now();
    if (initialAttributes) {
      this.setAttributes(initialAttributes);
    }
  }

  public setAttribute(key: string, value: any): this {
    this.attributes[key] = value;
    return this;
  }

  public setAttributes(attrs: Record<string, any>): this {
    Object.assign(this.attributes, attrs);
    return this;
  }

  public addEvent(name: string, attributes?: Record<string, any>): this {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
    return this;
  }

  public setStatus(status: SpanStatus, error?: Error): this {
    this.status = status;
    if (error) {
      this.error = error;
      this.setAttribute("error.message", error.message);
      this.setAttribute("error.name", error.name);
      if (error.stack) {
        this.setAttribute("error.stack", error.stack);
      }
    }
    return this;
  }

  public end(): this {
    if (this.endTime === undefined) {
      this.endTime = performance.now();
      this.durationMs = Number((this.endTime - this.startTime).toFixed(2));
      if (this.status === "UNSET") {
        this.status = "OK";
      }
    }
    return this;
  }

  public toTraceparent(): string {
    return formatTraceparent(this.traceId, this.spanId, true);
  }
}

/**
 * Creates a root span for an incoming operation, extracting an upstream traceparent if available.
 */
export function createRootSpan(
  name: string,
  traceparentHeader?: string | null,
  initialAttributes?: Record<string, any>
): Span {
  const context = parseTraceparent(traceparentHeader);
  if (context) {
    return new Span(
      name,
      context.traceId,
      generateSpanId(),
      context.parentId,
      initialAttributes
    );
  }
  return new Span(
    name,
    generateTraceId(),
    generateSpanId(),
    undefined,
    initialAttributes
  );
}

/**
 * Wraps an asynchronous operation with an active span.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  options?: {
    parentSpan?: Span | string;
    attributes?: Record<string, any>;
  }
): Promise<T> {
  let traceId = generateTraceId();
  let parentSpanId: string | undefined = undefined;

  if (options?.parentSpan) {
    if (typeof options.parentSpan === "string") {
      const parsed = parseTraceparent(options.parentSpan);
      if (parsed) {
        traceId = parsed.traceId;
        parentSpanId = parsed.parentId;
      }
    } else {
      traceId = options.parentSpan.traceId;
      parentSpanId = options.parentSpan.spanId;
    }
  }

  const span = new Span(
    name,
    traceId,
    generateSpanId(),
    parentSpanId,
    options?.attributes
  );

  try {
    const result = await fn(span);
    span.setStatus("OK");
    return result;
  } catch (err: any) {
    span.setStatus("ERROR", err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    span.end();
  }
}
