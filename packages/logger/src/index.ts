export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogContext {
  service?: string;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  [key: string]: any;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  tenant_id?: string;
  user_id?: string;
  metadata?: Record<string, any>;
  error?: SerializedError;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
  "ssn",
]);

export function sanitizeMetadata(data: any, depth = 0): any {
  if (depth > 5) return "[Truncated: Max Depth]";
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeMetadata(value, depth + 1);
    }
  }
  return sanitized;
}

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

export class Logger {
  private service: string;
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(service = "opsengine", context: LogContext = {}, minLevel: LogLevel = "INFO") {
    this.service = service;
    this.context = { ...context };
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[this.minLevel];
  }

  private write(level: LogLevel, message: string, meta?: Record<string, any>, err?: unknown): LogRecord {
    if (!this.shouldLog(level)) {
      return {} as LogRecord;
    }

    let serializedError: SerializedError | undefined = undefined;
    if (err) {
      if (err instanceof Error) {
        serializedError = {
          name: err.name,
          message: err.message,
          stack: err.stack,
        };
      } else {
        serializedError = {
          name: "UnknownError",
          message: String(err),
        };
      }
    }

    const { traceId, spanId, tenantId, userId, ...restContext } = this.context;
    const combinedMeta = { ...restContext, ...(meta || {}) };

    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      service: this.context.service || this.service,
      message,
      ...(traceId ? { trace_id: traceId } : {}),
      ...(spanId ? { span_id: spanId } : {}),
      ...(tenantId ? { tenant_id: tenantId } : {}),
      ...(userId ? { user_id: userId } : {}),
      ...(Object.keys(combinedMeta).length > 0 ? { metadata: sanitizeMetadata(combinedMeta) } : {}),
      ...(serializedError ? { error: serializedError } : {}),
    };

    const serialized = JSON.stringify(record);
    if (level === "ERROR") {
      process.stderr.write(serialized + "\n");
    } else {
      process.stdout.write(serialized + "\n");
    }

    return record;
  }

  public debug(message: string, meta?: Record<string, any>): LogRecord {
    return this.write("DEBUG", message, meta);
  }

  public info(message: string, meta?: Record<string, any>): LogRecord {
    return this.write("INFO", message, meta);
  }

  public warn(message: string, meta?: Record<string, any>): LogRecord {
    return this.write("WARN", message, meta);
  }

  public error(message: string, err?: unknown, meta?: Record<string, any>): LogRecord {
    return this.write("ERROR", message, meta, err);
  }

  public child(extraContext: LogContext): Logger {
    return new Logger(this.service, { ...this.context, ...extraContext }, this.minLevel);
  }

  public setContext(extraContext: LogContext): this {
    Object.assign(this.context, extraContext);
    return this;
  }

  public setMinLevel(level: LogLevel): this {
    this.minLevel = level;
    return this;
  }
}

export function createLogger(service = "opsengine", initialContext: LogContext = {}, minLevel: LogLevel = "INFO"): Logger {
  return new Logger(service, initialContext, minLevel);
}

export const logger = createLogger("opsengine-web");
