import { randomUUID } from "node:crypto";
import {
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookDelivery,
  WebhookEndpoint,
} from "./types";
import { generateWebhookSecret, signWebhookPayload } from "./crypto";
import { validateWebhookUrl } from "./ssrf";
import { calculateBackoffDelay, isTransientError } from "./backoff";

export class WebhookEngine {
  private endpoints = new Map<string, WebhookEndpoint>();
  private deliveries = new Map<string, WebhookDelivery>();

  /**
   * Resets all internal stores (used for testing isolation).
   */
  public reset(tenantId?: string): void {
    if (tenantId) {
      for (const [id, ep] of Array.from(this.endpoints.entries())) {
        if (ep.tenantId === tenantId) this.endpoints.delete(id);
      }
      for (const [id, del] of Array.from(this.deliveries.entries())) {
        if (del.tenantId === tenantId) this.deliveries.delete(id);
      }
    } else {
      this.endpoints.clear();
      this.deliveries.clear();
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Webhook Endpoint Management
  // ---------------------------------------------------------------------------

  public registerEndpoint(tenantId: string, input: CreateWebhookInput): WebhookEndpoint {
    if (!tenantId) throw new Error("tenantId is required");
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("Webhook name is required");
    }

    // SSRF Validation
    const ssrfCheck = validateWebhookUrl(input.url);
    if (!ssrfCheck.isValid) {
      throw new Error(`Invalid webhook destination URL: ${ssrfCheck.reason}`);
    }

    const secret = input.secret && input.secret.trim().length > 0
      ? input.secret.trim()
      : generateWebhookSecret();

    const id = randomUUID();
    const now = new Date().toISOString();

    const endpoint: WebhookEndpoint = {
      id,
      tenantId,
      name: input.name.trim(),
      url: input.url.trim(),
      secret,
      eventTypes: input.eventTypes && input.eventTypes.length > 0 ? input.eventTypes : ["*"],
      isActive: true,
      rateLimitPerMinute: input.rateLimitPerMinute || 120,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };

    this.endpoints.set(id, endpoint);
    return endpoint;
  }

  public updateEndpoint(tenantId: string, endpointId: string, input: UpdateWebhookInput): WebhookEndpoint {
    const existing = this.endpoints.get(endpointId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error("Webhook endpoint not found or access denied");
    }

    if (input.url) {
      const ssrfCheck = validateWebhookUrl(input.url);
      if (!ssrfCheck.isValid) {
        throw new Error(`Invalid webhook destination URL: ${ssrfCheck.reason}`);
      }
      existing.url = input.url.trim();
    }

    if (input.name) existing.name = input.name.trim();
    if (input.eventTypes) existing.eventTypes = input.eventTypes;
    if (typeof input.isActive === "boolean") existing.isActive = input.isActive;
    if (typeof input.rateLimitPerMinute === "number") existing.rateLimitPerMinute = input.rateLimitPerMinute;
    if (input.description !== undefined) existing.description = input.description;
    if (input.rotateSecret) existing.secret = generateWebhookSecret();

    existing.updatedAt = new Date().toISOString();
    this.endpoints.set(endpointId, existing);
    return existing;
  }

  public deleteEndpoint(tenantId: string, endpointId: string): boolean {
    const existing = this.endpoints.get(endpointId);
    if (!existing || existing.tenantId !== tenantId) {
      return false;
    }
    return this.endpoints.delete(endpointId);
  }

  public getEndpoints(tenantId: string): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter((e) => e.tenantId === tenantId);
  }

  public getEndpoint(tenantId: string, endpointId: string): WebhookEndpoint | null {
    const ep = this.endpoints.get(endpointId);
    if (!ep || ep.tenantId !== tenantId) return null;
    return ep;
  }

  // ---------------------------------------------------------------------------
  // 2. Event Matching & Delivery Scheduling
  // ---------------------------------------------------------------------------

  public matchEvent(eventName: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern === "*") return true;
      if (pattern.endsWith(".*")) {
        const prefix = pattern.slice(0, -2);
        if (eventName === prefix || eventName.startsWith(`${prefix}.`)) return true;
      }
      if (pattern === eventName) return true;
    }
    return false;
  }

  public scheduleDeliveriesForEvent(event: {
    id: string;
    name: string;
    tenantId: string;
    payload: Record<string, unknown>;
  }): WebhookDelivery[] {
    const tenantEndpoints = this.getEndpoints(event.tenantId).filter((e) => e.isActive);
    const scheduled: WebhookDelivery[] = [];
    const now = new Date().toISOString();

    for (const endpoint of tenantEndpoints) {
      if (this.matchEvent(event.name, endpoint.eventTypes)) {
        const deliveryId = randomUUID();
        const delivery: WebhookDelivery = {
          id: deliveryId,
          tenantId: event.tenantId,
          webhookId: endpoint.id,
          eventId: event.id,
          eventName: event.name,
          status: "PENDING",
          attemptCount: 0,
          maxAttempts: 5,
          nextAttemptAt: now,
          requestHeaders: {},
          requestPayload: event.payload,
          responseStatus: null,
          responseBody: null,
          executionLatencyMs: null,
          errorDetails: null,
          createdAt: now,
          updatedAt: now,
        };

        this.deliveries.set(deliveryId, delivery);
        scheduled.push(delivery);
      }
    }

    return scheduled;
  }

  // ---------------------------------------------------------------------------
  // 3. Dispatch & Retry Pipeline
  // ---------------------------------------------------------------------------

  public async dispatchDelivery(
    deliveryId: string,
    customFetch: typeof fetch = fetch
  ): Promise<WebhookDelivery> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Webhook delivery '${deliveryId}' not found`);
    }

    const endpoint = this.endpoints.get(delivery.webhookId);
    if (!endpoint) {
      delivery.status = "DEAD_LETTER";
      delivery.errorDetails = "Webhook endpoint has been deleted or deactivated";
      delivery.updatedAt = new Date().toISOString();
      return delivery;
    }

    delivery.attemptCount += 1;
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const serializedPayload = JSON.stringify(delivery.requestPayload);

    // Cryptographic HMAC-SHA256 signature
    const { signatureHeader } = signWebhookPayload(serializedPayload, endpoint.secret, nowTimestamp);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "OpsEngine-Webhook-Dispatcher/1.0",
      "X-OpsEngine-Event-Type": delivery.eventName,
      "X-OpsEngine-Delivery-Id": delivery.id,
      "X-OpsEngine-Event-Id": delivery.eventId,
      "X-OpsEngine-Tenant-Id": delivery.tenantId,
      "X-OpsEngine-Timestamp": String(nowTimestamp),
      "X-OpsEngine-Signature-256": signatureHeader,
    };

    delivery.requestHeaders = headers;

    const startTime = Date.now();
    try {
      const response = await customFetch(endpoint.url, {
        method: "POST",
        headers,
        body: serializedPayload,
        signal: AbortSignal.timeout(6000),
      });

      const latency = Date.now() - startTime;
      delivery.executionLatencyMs = latency;
      delivery.responseStatus = response.status;

      let bodyText = "";
      try {
        bodyText = await response.text();
        delivery.responseBody = bodyText.slice(0, 1024); // Store reasonable excerpt
      } catch {
        delivery.responseBody = null;
      }

      if (response.ok) {
        delivery.status = "SUCCESS";
        delivery.nextAttemptAt = null;
        delivery.errorDetails = null;
      } else {
        const isTransient = isTransientError(response.status);
        if (!isTransient || delivery.attemptCount >= delivery.maxAttempts) {
          delivery.status = "DEAD_LETTER";
          delivery.nextAttemptAt = null;
          delivery.errorDetails = `HTTP ${response.status}: Non-transient or exhausted retries (${delivery.attemptCount}/${delivery.maxAttempts})`;
        } else {
          delivery.status = "FAILED";
          const delayMs = calculateBackoffDelay(delivery.attemptCount);
          delivery.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
          delivery.errorDetails = `HTTP ${response.status}: Transient failure; scheduled retry in ${delayMs}ms`;
        }
      }
    } catch (err: unknown) {
      const latency = Date.now() - startTime;
      delivery.executionLatencyMs = latency;
      const errorMsg = err instanceof Error ? err.message : String(err);
      delivery.errorDetails = errorMsg;

      const isTransient = isTransientError(null, errorMsg);
      if (!isTransient || delivery.attemptCount >= delivery.maxAttempts) {
        delivery.status = "DEAD_LETTER";
        delivery.nextAttemptAt = null;
      } else {
        delivery.status = "FAILED";
        const delayMs = calculateBackoffDelay(delivery.attemptCount);
        delivery.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
      }
    }

    delivery.updatedAt = new Date().toISOString();
    this.deliveries.set(deliveryId, delivery);
    return delivery;
  }

  // ---------------------------------------------------------------------------
  // 4. DLQ & Replay Mechanism
  // ---------------------------------------------------------------------------

  public async replayDelivery(
    tenantId: string,
    deliveryId: string,
    autoDispatch: boolean = false,
    customFetch: typeof fetch = fetch
  ): Promise<WebhookDelivery> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.tenantId !== tenantId) {
      throw new Error("Webhook delivery not found or cross-tenant access denied");
    }

    // Reset delivery for immediate retry
    delivery.status = "PENDING";
    delivery.attemptCount = 0;
    delivery.nextAttemptAt = new Date().toISOString();
    delivery.errorDetails = null;
    delivery.updatedAt = new Date().toISOString();
    this.deliveries.set(deliveryId, delivery);

    if (autoDispatch) {
      return await this.dispatchDelivery(deliveryId, customFetch);
    }

    return delivery;
  }

  public getDeliveries(tenantId: string, webhookId?: string, status?: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter((d) => d.tenantId === tenantId)
      .filter((d) => (webhookId ? d.webhookId === webhookId : true))
      .filter((d) => (status ? d.status === status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getDeadLetterQueue(tenantId: string): WebhookDelivery[] {
    return this.getDeliveries(tenantId, undefined, "DEAD_LETTER");
  }

  public async replayAllDeadLetter(
    tenantId: string,
    autoDispatch: boolean = false,
    customFetch: typeof fetch = fetch
  ): Promise<WebhookDelivery[]> {
    const dlq = this.getDeadLetterQueue(tenantId);
    const replayed: WebhookDelivery[] = [];
    for (const item of dlq) {
      const res = await this.replayDelivery(tenantId, item.id, autoDispatch, customFetch);
      replayed.push(res);
    }
    return replayed;
  }
}

export const globalWebhookEngine = new WebhookEngine();
