/**
 * Tenant Lifecycle & Quarantine Service
 * Enforces immediate edge suspension and break-glass audit logs
 * PRD Module 0A & §18.7 (Runbooks: Tenant Quarantine)
 */

import { TenantLifecycleRecord } from "./types";
import { globalEventBus, createDomainEvent, DomainEventNames } from "@opsengine/domain-events";

export class TenantLifecycleService {
  private states = new Map<string, TenantLifecycleRecord>();

  /**
   * Retrieves current lifecycle state for a tenant (defaults to ACTIVE)
   */
  public getState(tenantId: string): TenantLifecycleRecord {
    const existing = this.states.get(tenantId);
    if (existing) return existing;

    const initial: TenantLifecycleRecord = {
      tenantId,
      state: "ACTIVE",
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
      history: [
        {
          state: "ACTIVE",
          timestamp: new Date().toISOString(),
          operatorId: "system",
          reason: "Initial tenant provisioning",
        },
      ],
    };

    this.states.set(tenantId, initial);
    return initial;
  }

  /**
   * Quarantines a tenant immediately, revoking all edge and API access
   */
  public quarantine(
    tenantId: string,
    reason: string,
    operatorId: string = "root-admin"
  ): TenantLifecycleRecord {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Quarantine justification reason is strictly mandatory for audit compliance");
    }

    const current = this.getState(tenantId);
    const now = new Date().toISOString();

    current.state = "QUARANTINED";
    current.updatedAt = now;
    current.updatedBy = operatorId;
    current.reason = reason;
    current.quarantinedAt = now;
    current.history.push({
      state: "QUARANTINED",
      timestamp: now,
      operatorId,
      reason,
    });

    this.states.set(tenantId, current);

    // Emit domain event for multi-service coordination
    try {
      globalEventBus.publish(
        createDomainEvent({
          name: DomainEventNames.TENANT_LIFECYCLE_CHANGED,
          tenantId,
          aggregateId: tenantId,
          aggregateType: "tenant",
          payload: {
            state: "QUARANTINED",
            reason,
            operatorId,
          },
        })
      );
    } catch {}

    return current;
  }

  /**
   * Reinstates a quarantined tenant back to ACTIVE status
   */
  public reinstate(
    tenantId: string,
    reason: string,
    operatorId: string = "root-admin"
  ): TenantLifecycleRecord {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Reinstatement justification reason is strictly mandatory for audit compliance");
    }

    const current = this.getState(tenantId);
    const now = new Date().toISOString();

    current.state = "ACTIVE";
    current.updatedAt = now;
    current.updatedBy = operatorId;
    current.reason = reason;
    current.history.push({
      state: "ACTIVE",
      timestamp: now,
      operatorId,
      reason,
    });

    this.states.set(tenantId, current);

    try {
      globalEventBus.publish(
        createDomainEvent({
          name: DomainEventNames.TENANT_LIFECYCLE_CHANGED,
          tenantId,
          aggregateId: tenantId,
          aggregateType: "tenant",
          payload: {
            state: "ACTIVE",
            reason,
            operatorId,
          },
        })
      );
    } catch {}

    return current;
  }

  /**
   * Marks a tenant as OFFBOARDED prior to data purging
   */
  public offboard(
    tenantId: string,
    reason: string,
    operatorId: string = "root-admin"
  ): TenantLifecycleRecord {
    const current = this.getState(tenantId);
    const now = new Date().toISOString();

    current.state = "OFFBOARDED";
    current.updatedAt = now;
    current.updatedBy = operatorId;
    current.reason = reason;
    current.offboardedAt = now;
    current.history.push({
      state: "OFFBOARDED",
      timestamp: now,
      operatorId,
      reason,
    });

    this.states.set(tenantId, current);
    return current;
  }

  /**
   * Fast edge check: Returns true if tenant is quarantined or purged
   */
  public isQuarantined(tenantId: string): boolean {
    const record = this.states.get(tenantId);
    if (!record) return false;
    return record.state === "QUARANTINED" || record.state === "PURGED";
  }

  /**
   * Clear in-memory state (for tests)
   */
  public reset(): void {
    this.states.clear();
  }
}

const globalForTenancy = globalThis as unknown as {
  __OPSENGINE_TENANT_LIFECYCLE__?: TenantLifecycleService;
};

export const globalTenantLifecycleService =
  globalForTenancy.__OPSENGINE_TENANT_LIFECYCLE__ ?? new TenantLifecycleService();

if (process.env.NODE_ENV !== "production") {
  globalForTenancy.__OPSENGINE_TENANT_LIFECYCLE__ = globalTenantLifecycleService;
}
