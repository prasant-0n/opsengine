/**
 * High-Performance Multi-Tenant Domain Event Bus
 * Enforces PRD §11 (Domain Events and Integration Contracts)
 * Strict Tenant Boundary Isolation & OpenTelemetry Correlation
 */

import { DomainEvent, EventHandler, EventSubscription, SubscriptionOptions, IdempotencyStore } from "./types";
import { globalIdempotencyStore } from "./idempotency";
import { randomUUID } from "node:crypto";

export interface EventBusOptions {
  idempotencyStore?: IdempotencyStore;
  maxRecentEvents?: number;
}

export class DomainEventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private idempotencyStore: IdempotencyStore;
  private recentEvents: DomainEvent[] = [];
  private maxRecentEvents: number;

  constructor(options?: EventBusOptions) {
    this.idempotencyStore = options?.idempotencyStore || globalIdempotencyStore;
    this.maxRecentEvents = options?.maxRecentEvents || 200;
  }

  /**
   * Subscribe an event handler to a pattern (e.g. "finance.invoice.issued.v1", "finance.*", "*")
   */
  public subscribe<T = Record<string, unknown>>(
    pattern: string,
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): () => void {
    const id = randomUUID();
    const subscription: EventSubscription = {
      id,
      pattern,
      tenantId: options?.tenantId || "*",
      consumerName: options?.consumerName,
      priority: options?.priority || 0,
      handler: handler as EventHandler<any>,
    };

    this.subscriptions.set(id, subscription);

    return () => {
      this.subscriptions.delete(id);
    };
  }

  /**
   * Unsubscribe a handler by subscription ID
   */
  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Matches an event name against a subscription pattern
   * e.g. "finance.invoice.issued.v1" matches "finance.invoice.issued.v1", "finance.*", or "*"
   */
  private matchesPattern(pattern: string, eventName: string): boolean {
    if (pattern === "*" || pattern === eventName) {
      return true;
    }
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return eventName.startsWith(prefix);
    }
    return false;
  }

  /**
   * Publish a domain event to all eligible subscribers with tenant-isolation & idempotency checks
   */
  public async publish<T = Record<string, unknown>>(event: DomainEvent<T>): Promise<number> {
    if (!event || !event.name || !event.tenantId) {
      throw new Error("Invalid event: name and tenantId are mandatory");
    }

    // Record into recent events ring buffer for observability
    this.recentEvents.unshift(event as DomainEvent);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.pop();
    }

    // Filter matching subscriptions sorted by priority (descending)
    const candidates = Array.from(this.subscriptions.values())
      .filter((sub) => this.matchesPattern(sub.pattern, event.name))
      .sort((a, b) => b.priority - a.priority);

    let deliveredCount = 0;

    for (const sub of candidates) {
      // 1. Strict Tenant Boundary Isolation (PRD Binding Rule)
      // If subscription is tenant-scoped, reject cross-tenant delivery
      if (sub.tenantId !== "*" && sub.tenantId !== event.tenantId) {
        continue;
      }

      // 2. Idempotency Check (PRD §11)
      if (sub.consumerName) {
        const isFirstClaim = this.idempotencyStore.claim(event.id, sub.consumerName);
        if (!isFirstClaim) {
          // Already handled by this consumer; skip execution
          continue;
        }
      }

      // 3. Execute handler
      try {
        await sub.handler(event);
        deliveredCount++;
      } catch (err) {
        // Log handler error without bringing down the bus
        console.error(
          `[DomainEventBus] Handler error on event ${event.name} (${event.id}) for subscriber ${sub.id}:`,
          err
        );
      }
    }

    return deliveredCount;
  }

  /**
   * Returns recent events for admin observability
   */
  public getRecentEvents(limit: number = 50, tenantId?: string): DomainEvent[] {
    let list = this.recentEvents;
    if (tenantId && tenantId !== "*") {
      list = list.filter((e) => e.tenantId === tenantId);
    }
    return list.slice(0, limit);
  }

  /**
   * Clear all subscriptions and event history (used in test setup)
   */
  public reset(): void {
    this.subscriptions.clear();
    this.recentEvents = [];
  }
}

export const globalEventBus = new DomainEventBus();
