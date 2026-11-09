/**
 * Real-Time Notification & SSE Types
 * PRD Module 15 (Notifications) & PRD §11 (Domain Events)
 */

export type NotificationCategory =
  | "APPROVAL"
  | "TICKET"
  | "ATTENDANCE"
  | "FINANCE"
  | "SYSTEM";

export type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";

export interface AppNotification {
  id: string;
  tenantId: string;
  userId?: string; // Optional target user; if omitted, targets all tenant members
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  link?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface StreamClient {
  id: string;
  tenantId: string;
  userId: string;
  enqueue: (chunk: string) => void;
  close: () => void;
  createdAt: string;
}

export interface NotificationFilter {
  tenantId: string;
  userId?: string;
  unreadOnly?: boolean;
  limit?: number;
}
