/**
 * Idempotency Store for Domain Event Deduplication
 * PRD §11: "Event consumers must handle duplicate delivery and out-of-order events safely."
 */

import { IdempotencyStore } from "./types";

interface ProcessedEntry {
  claimedAt: number;
  expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private records = new Map<string, ProcessedEntry>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 3600000) { // default 1 hour
    this.defaultTtlMs = defaultTtlMs;
  }

  private getKey(eventId: string, consumerName: string): string {
    return `${eventId}:${consumerName}`;
  }

  public claim(eventId: string, consumerName: string, ttlMs?: number): boolean {
    const key = this.getKey(eventId, consumerName);
    const now = Date.now();
    const existing = this.records.get(key);

    if (existing && existing.expiresAt > now) {
      // Already claimed and not expired -> duplicate
      return false;
    }

    const ttl = ttlMs ?? this.defaultTtlMs;
    this.records.set(key, {
      claimedAt: now,
      expiresAt: now + ttl,
    });

    return true;
  }

  public isProcessed(eventId: string, consumerName: string): boolean {
    const key = this.getKey(eventId, consumerName);
    const existing = this.records.get(key);
    if (!existing) return false;
    return existing.expiresAt > Date.now();
  }

  public purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.records.entries()) {
      if (entry.expiresAt <= now) {
        this.records.delete(key);
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    this.records.clear();
  }

  public size(): number {
    return this.records.size;
  }
}

export const globalIdempotencyStore = new InMemoryIdempotencyStore();
