/**
 * Webhook Engine Types & Models
 * Specified in PRD §11 (Domain Events), §12.3, §14.2 (Reliability) & §14.3 (Security)
 */

export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  secret: string;
  eventTypes: string[];
  isActive: boolean;
  rateLimitPerMinute: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type WebhookDeliveryStatus = "PENDING" | "SUCCESS" | "FAILED" | "DEAD_LETTER";

export interface WebhookDelivery {
  id: string;
  tenantId: string;
  webhookId: string;
  eventId: string;
  eventName: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  requestHeaders: Record<string, string>;
  requestPayload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  executionLatencyMs: number | null;
  errorDetails: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  secret?: string;
  eventTypes: string[];
  rateLimitPerMinute?: number;
  description?: string;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  eventTypes?: string[];
  isActive?: boolean;
  rateLimitPerMinute?: number;
  description?: string;
  rotateSecret?: boolean;
}

export interface WebhookDispatchResult {
  deliveryId: string;
  status: WebhookDeliveryStatus;
  responseStatus?: number;
  executionLatencyMs: number;
  error?: string;
}
