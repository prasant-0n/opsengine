/**
 * Real-Time Notification Hub & SSE Dispatcher
 * Bridges @opsengine/domain-events directly to browser Server-Sent Events
 * PRD Module 15 (Notifications) & PRD §11 (Domain Events)
 */

import { AppNotification, StreamClient, NotificationFilter } from "./types";
import { globalEventBus, DomainEvent, DomainEventNames, DomainEventBus } from "@opsengine/domain-events";
import { randomUUID } from "node:crypto";

export class NotificationHub {
  private connections = new Map<string, StreamClient>();
  private notifications = new Map<string, AppNotification[]>();
  private maxStoredPerTenant: number;
  private boundBuses = new Set<DomainEventBus>();

  constructor(options?: { maxStoredPerTenant?: number; bindGlobalBus?: boolean }) {
    this.maxStoredPerTenant = options?.maxStoredPerTenant || 100;
    if (options?.bindGlobalBus !== false) {
      this.bindDomainEvents(globalEventBus);
    }
  }

  /**
   * Formats a message into a standard Server-Sent Events (SSE) wire chunk
   */
  public static formatSse(event: string, data: Record<string, unknown>): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  /**
   * Registers a new persistent SSE client stream
   */
  public register(
    params: Omit<StreamClient, "id" | "createdAt">
  ): { id: string; unsubscribe: () => void } {
    const id = randomUUID();
    const client: StreamClient = {
      ...params,
      id,
      createdAt: new Date().toISOString(),
    };

    this.connections.set(id, client);

    // Initial connection handshake
    const handshake = NotificationHub.formatSse("connected", {
      status: "connected",
      connectionId: id,
      tenantId: client.tenantId,
      userId: client.userId,
      timestamp: new Date().toISOString(),
    });
    client.enqueue(handshake);

    return {
      id,
      unsubscribe: () => {
        this.connections.delete(id);
      },
    };
  }

  /**
   * Dispatches a notification to all eligible client streams within the target tenant
   */
  public dispatch(notification: AppNotification): number {
    if (!notification.id) notification.id = randomUUID();
    if (!notification.createdAt) notification.createdAt = new Date().toISOString();

    // 1. Store in tenant notification registry
    const list = this.notifications.get(notification.tenantId) || [];
    list.unshift(notification);
    if (list.length > this.maxStoredPerTenant) {
      list.pop();
    }
    this.notifications.set(notification.tenantId, list);

    // 2. Calculate current unread count for the tenant
    const unreadCount = list.filter((n) => !n.isRead).length;

    // 3. Format SSE payload
    const chunk = NotificationHub.formatSse("notification", {
      ...notification,
      unreadCount,
    });

    // 4. Deliver strictly to matching tenant connections (Negative Tenant Gate)
    let delivered = 0;
    for (const client of this.connections.values()) {
      if (client.tenantId !== notification.tenantId) {
        continue; // Cross-tenant negative gate: strictly isolate
      }

      // Check user targeting if specific user targeted
      if (notification.userId && client.userId !== notification.userId) {
        continue;
      }

      try {
        client.enqueue(chunk);
        delivered++;
      } catch (err) {
        console.error(`[NotificationHub] Error enqueuing to client ${client.id}:`, err);
      }
    }

    return delivered;
  }

  /**
   * Retrieves notifications for a tenant with optional user and unread filtering
   */
  public getNotifications(filter: NotificationFilter): {
    notifications: AppNotification[];
    unreadCount: number;
    total: number;
  } {
    const list = this.notifications.get(filter.tenantId) || [];
    let filtered = list;

    if (filter.userId) {
      filtered = filtered.filter((n) => !n.userId || n.userId === filter.userId);
    }
    if (filter.unreadOnly) {
      filtered = filtered.filter((n) => !n.isRead);
    }

    const limit = filter.limit || 50;
    const unreadCount = list.filter((n) => !n.isRead).length;

    return {
      notifications: filtered.slice(0, limit),
      unreadCount,
      total: list.length,
    };
  }

  /**
   * Marks a notification (or all notifications) as read for a tenant
   */
  public markAsRead(
    tenantId: string,
    notificationId?: string,
    userId?: string
  ): { updatedCount: number; unreadCount: number } {
    const list = this.notifications.get(tenantId) || [];
    let updatedCount = 0;

    for (const n of list) {
      if (userId && n.userId && n.userId !== userId) continue;

      if (!notificationId || n.id === notificationId) {
        if (!n.isRead) {
          n.isRead = true;
          updatedCount++;
        }
      }
    }

    const unreadCount = list.filter((n) => !n.isRead).length;

    // Push badge update to active streams
    const badgeChunk = NotificationHub.formatSse("badge_update", {
      tenantId,
      unreadCount,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.connections.values()) {
      if (client.tenantId === tenantId) {
        try {
          client.enqueue(badgeChunk);
        } catch {}
      }
    }

    return { updatedCount, unreadCount };
  }

  /**
   * Broadcasts keep-alive heartbeat to all open SSE connections
   */
  public sendHeartbeat(): number {
    const chunk = NotificationHub.formatSse("heartbeat", {
      timestamp: new Date().toISOString(),
    });

    let sent = 0;
    for (const client of this.connections.values()) {
      try {
        client.enqueue(chunk);
        sent++;
      } catch {}
    }
    return sent;
  }

  /**
   * Binds domain events from @opsengine/domain-events into user notifications
   */
  public bindDomainEvents(eventBus: any = globalEventBus): () => void {
    if (this.boundBuses.has(eventBus)) return () => {};
    this.boundBuses.add(eventBus);

    // 1. Approval Created -> Alert Approvers
    const unsub1 = eventBus.subscribe(DomainEventNames.WORKFLOW_APPROVAL_CREATED, (event: DomainEvent) => {
      this.dispatch({
        id: randomUUID(),
        tenantId: event.tenantId,
        title: "New Approval Required",
        message: (event.payload?.title as string) || "Pending approval request requires your review",
        category: "APPROVAL",
        severity: "WARNING",
        link: "/dashboard/approvals",
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: { aggregateId: event.aggregateId },
      });
    });

    // 2. Ticket Assigned -> Alert Assignee
    const unsub2 = eventBus.subscribe(DomainEventNames.WORK_TICKET_ASSIGNED, (event: DomainEvent) => {
      this.dispatch({
        id: randomUUID(),
        tenantId: event.tenantId,
        userId: event.payload?.assignedToUserId as string | undefined,
        title: "Work Ticket Assigned",
        message: (event.payload?.title as string) || "You have been assigned to a new operational ticket",
        category: "TICKET",
        severity: "INFO",
        link: "/dashboard/tickets",
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: { aggregateId: event.aggregateId },
      });
    });

    // 3. Attendance Correction Approved
    const unsub3 = eventBus.subscribe(DomainEventNames.ATTENDANCE_CORRECTION_APPROVED, (event: DomainEvent) => {
      this.dispatch({
        id: randomUUID(),
        tenantId: event.tenantId,
        userId: event.payload?.employeeId as string | undefined,
        title: "Attendance Correction Approved",
        message: "Your attendance regularization request has been approved",
        category: "ATTENDANCE",
        severity: "SUCCESS",
        link: "/dashboard/time",
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    });

    // 4. Overdue Invoice Alert
    const unsub4 = eventBus.subscribe(DomainEventNames.FINANCE_RECEIVABLE_OVERDUE, (event: DomainEvent) => {
      this.dispatch({
        id: randomUUID(),
        tenantId: event.tenantId,
        title: "Invoice Receivable Overdue",
        message: `Invoice #${event.aggregateId} payment has crossed credit period`,
        category: "FINANCE",
        severity: "CRITICAL",
        link: "/dashboard/finance",
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      this.boundBuses.delete(eventBus);
    };
  }

  public getActiveConnectionCount(tenantId?: string): number {
    if (!tenantId || tenantId === "*") return this.connections.size;
    let count = 0;
    for (const c of this.connections.values()) {
      if (c.tenantId === tenantId) count++;
    }
    return count;
  }

  public reset(): void {
    this.connections.clear();
    this.notifications.clear();
  }
}

export const globalNotificationHub = new NotificationHub();
