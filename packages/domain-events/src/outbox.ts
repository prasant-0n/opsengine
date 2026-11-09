/**
 * Transactional Outbox Engine
 * Implements Guaranteed At-Least-Once Delivery Pattern (PRD §14.2)
 * Supports exponential retry backoff, dead-letter queue, and atomic state updates
 */

import { DomainEvent, OutboxMessage, OutboxMessageStatus } from "./types";
import { DomainEventBus, globalEventBus } from "./bus";
import { randomUUID } from "node:crypto";

export interface OutboxStoreOptions {
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export class TransactionalOutbox {
  private messages = new Map<string, OutboxMessage>();
  private maxRetries: number;
  private baseBackoffMs: number;
  private maxBackoffMs: number;

  constructor(options?: OutboxStoreOptions) {
    this.maxRetries = options?.maxRetries || 3;
    this.baseBackoffMs = options?.baseBackoffMs || 1000; // 1 second
    this.maxBackoffMs = options?.maxBackoffMs || 300000; // 5 minutes
  }

  /**
   * Enqueues a domain event to the outbox
   */
  public enqueue<T = Record<string, unknown>>(event: DomainEvent<T>): OutboxMessage {
    const id = randomUUID();
    const now = new Date().toISOString();

    const record: OutboxMessage = {
      id,
      tenantId: event.tenantId,
      eventName: event.name,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payloadJson: JSON.stringify(event),
      status: "PENDING",
      retryCount: 0,
      maxRetries: this.maxRetries,
      lastError: null,
      nextRetryAt: now,
      createdAt: now,
      publishedAt: null,
    };

    this.messages.set(id, record);
    return record;
  }

  /**
   * Fetches messages that are pending or due for retry
   */
  public fetchPendingBatch(limit: number = 50): OutboxMessage[] {
    const now = new Date().toISOString();
    const result: OutboxMessage[] = [];

    for (const msg of this.messages.values()) {
      if (
        (msg.status === "PENDING" || msg.status === "FAILED") &&
        msg.nextRetryAt <= now
      ) {
        result.push(msg);
        if (result.length >= limit) break;
      }
    }

    return result;
  }

  /**
   * Marks a message as successfully published
   */
  public markPublished(id: string): void {
    const msg = this.messages.get(id);
    if (msg) {
      msg.status = "PUBLISHED";
      msg.publishedAt = new Date().toISOString();
      msg.lastError = null;
    }
  }

  /**
   * Records a delivery failure with exponential backoff calculation or DLQ transition
   */
  public recordFailure(id: string, errorMessage: string): void {
    const msg = this.messages.get(id);
    if (!msg) return;

    msg.retryCount += 1;
    msg.lastError = errorMessage;

    if (msg.retryCount >= msg.maxRetries) {
      msg.status = "DEAD_LETTER";
    } else {
      msg.status = "FAILED";
      const delay = Math.min(
        this.maxBackoffMs,
        this.baseBackoffMs * Math.pow(2, msg.retryCount - 1)
      );
      msg.nextRetryAt = new Date(Date.now() + delay).toISOString();
    }
  }

  /**
   * Manually requeues a dead-letter message for retry
   */
  public retryDeadLetter(id: string): boolean {
    const msg = this.messages.get(id);
    if (!msg || msg.status !== "DEAD_LETTER") return false;

    msg.status = "PENDING";
    msg.retryCount = 0;
    msg.nextRetryAt = new Date().toISOString();
    msg.lastError = null;
    return true;
  }

  /**
   * Processes a batch of pending/failed messages through the EventBus
   */
  public async processBatch(
    eventBus: DomainEventBus = globalEventBus,
    batchSize: number = 50
  ): Promise<{ processed: number; published: number; failed: number }> {
    const batch = this.fetchPendingBatch(batchSize);
    let published = 0;
    let failed = 0;

    for (const msg of batch) {
      try {
        const event: DomainEvent = JSON.parse(msg.payloadJson);
        await eventBus.publish(event);
        this.markPublished(msg.id);
        published++;
      } catch (err: any) {
        this.recordFailure(msg.id, err?.message || "Event publication failed");
        failed++;
      }
    }

    return {
      processed: batch.length,
      published,
      failed,
    };
  }

  /**
   * Returns aggregated status summary (useful for dashboards and health metrics)
   */
  public getSummary(tenantId?: string): {
    pending: number;
    published: number;
    failed: number;
    deadLetter: number;
    total: number;
  } {
    let pending = 0;
    let published = 0;
    let failed = 0;
    let deadLetter = 0;

    for (const msg of this.messages.values()) {
      if (tenantId && tenantId !== "*" && msg.tenantId !== tenantId) {
        continue;
      }
      if (msg.status === "PENDING") pending++;
      else if (msg.status === "PUBLISHED") published++;
      else if (msg.status === "FAILED") failed++;
      else if (msg.status === "DEAD_LETTER") deadLetter++;
    }

    return {
      pending,
      published,
      failed,
      deadLetter,
      total: pending + published + failed + deadLetter,
    };
  }

  /**
   * Returns message list with filtering
   */
  public getMessages(options?: {
    tenantId?: string;
    status?: OutboxMessageStatus;
    limit?: number;
  }): OutboxMessage[] {
    const limit = options?.limit || 50;
    const result: OutboxMessage[] = [];

    for (const msg of this.messages.values()) {
      if (options?.tenantId && options.tenantId !== "*" && msg.tenantId !== options.tenantId) {
        continue;
      }
      if (options?.status && msg.status !== options.status) {
        continue;
      }
      result.unshift(msg);
      if (result.length >= limit) break;
    }

    return result;
  }

  /**
   * Clear all outbox messages (for testing)
   */
  public reset(): void {
    this.messages.clear();
  }
}

export const globalTransactionalOutbox = new TransactionalOutbox();
