/**
 * Domain Events & Transactional Outbox Type Definitions
 * Specified in PRD §11 (Domain Events and Integration Contracts) & §14.2
 */

export interface DomainEvent<TPayload = Record<string, unknown>> {
  /** Unique Event Identifier (UUID v4) */
  id: string;

  /** Fully qualified event name in format `<domain>.<entity>.<action>.<version>` */
  name: string;

  /** Verified tenant identifier, or "system" for platform-wide events */
  tenantId: string;

  /** Aggregate / Root Entity Identifier (e.g. ticket ID, employee ID, invoice ID) */
  aggregateId: string;

  /** Aggregate type name (e.g. "ticket", "invoice", "tenant", "employee") */
  aggregateType: string;

  /** Schema contract version */
  version: number;

  /** ISO 8601 UTC timestamp of event generation */
  timestamp: string;

  /** W3C TraceContext trace ID / correlation ID */
  correlationId: string;

  /** ID of the command or parent event that caused this event */
  causationId?: string;

  /** Validated minimal non-PII domain payload */
  payload: TPayload;

  /** Optional contextual metadata */
  metadata?: {
    actorId?: string;
    actorRole?: string;
    isReplay?: boolean;
    ipAddress?: string;
    [key: string]: unknown;
  };
}

export type OutboxMessageStatus = "PENDING" | "PUBLISHED" | "FAILED" | "DEAD_LETTER";

export interface OutboxMessage {
  id: string;
  tenantId: string;
  eventName: string;
  aggregateId: string;
  aggregateType: string;
  payloadJson: string;
  status: OutboxMessageStatus;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  nextRetryAt: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface EventHandler<T = Record<string, unknown>> {
  (event: DomainEvent<T>): Promise<void> | void;
}

export interface SubscriptionOptions {
  /** Filter to specific tenant ID, or "*" for platform-wide listener */
  tenantId?: string;

  /** Unique consumer identifier for idempotency tracking (e.g. "audit-logger") */
  consumerName?: string;

  /** Priority ordering (higher runs first) */
  priority?: number;
}

export interface EventSubscription {
  id: string;
  pattern: string;
  tenantId: string;
  consumerName?: string;
  priority: number;
  handler: EventHandler<any>;
}

export interface IdempotencyStore {
  /**
   * Attempts to mark an event as being processed by a consumer.
   * Returns true if first time (unique), false if already processed (duplicate).
   */
  claim(eventId: string, consumerName: string, ttlMs?: number): boolean;

  /** Checks if event has already been claimed */
  isProcessed(eventId: string, consumerName: string): boolean;

  /** Evicts expired claims */
  purgeExpired(): number;
}
