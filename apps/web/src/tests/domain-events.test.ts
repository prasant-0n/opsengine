import { describe, it, expect, beforeEach } from "vitest";
import {
  DomainEventBus,
  TransactionalOutbox,
  InMemoryIdempotencyStore,
  createDomainEvent,
  DomainEventNames,
} from "@opsengine/domain-events";
import { GET as getOutboxRoute, POST as postOutboxRoute } from "../app/api/events/outbox/route";
import { NextRequest } from "next/server";

describe("Multi-Tenant Domain Event Bus & Outbox Integration Pipeline (PRD §11 & §14.2)", () => {
  let eventBus: DomainEventBus;
  let idempotencyStore: InMemoryIdempotencyStore;
  let outbox: TransactionalOutbox;

  beforeEach(() => {
    idempotencyStore = new InMemoryIdempotencyStore();
    eventBus = new DomainEventBus({ idempotencyStore });
    outbox = new TransactionalOutbox({ maxRetries: 3, baseBackoffMs: 100 });
  });

  describe("1. Domain Event Creation & Contract Enforcement (PRD §11)", () => {
    it("creates a well-formed domain event with mandatory correlation, version, and timestamps", () => {
      const event = createDomainEvent({
        name: DomainEventNames.WORKFLOW_APPROVAL_CREATED,
        tenantId: "tenant_alpha",
        aggregateId: "apr_99182",
        aggregateType: "approval",
        payload: {
          requestId: "req_100",
          step: "FINANCE_LEAD_REVIEW",
          amount: 50000,
        },
      });

      expect(event.id).toBeDefined();
      expect(event.id.length).toBeGreaterThan(10);
      expect(event.name).toBe("workflow.approval.created.v1");
      expect(event.tenantId).toBe("tenant_alpha");
      expect(event.aggregateId).toBe("apr_99182");
      expect(event.aggregateType).toBe("approval");
      expect(event.version).toBe(1);
      expect(event.timestamp).toBeDefined();
      expect(event.correlationId).toBeDefined();
      expect(event.payload.amount).toBe(50000);
    });

    it("fails closed when tenantId or event name is missing", () => {
      expect(() => {
        createDomainEvent({
          name: "",
          tenantId: "tenant_alpha",
          aggregateId: "agg_1",
          aggregateType: "ticket",
          payload: {},
        });
      }).toThrow(/name is required/);

      expect(() => {
        createDomainEvent({
          name: DomainEventNames.WORK_TICKET_CREATED,
          tenantId: "",
          aggregateId: "agg_1",
          aggregateType: "ticket",
          payload: {},
        });
      }).toThrow(/tenantId must be non-empty/);
    });
  });

  describe("2. Domain Event Bus Routing & Wildcards", () => {
    it("delivers events to exact-match pattern subscribers", async () => {
      let received = false;
      eventBus.subscribe(DomainEventNames.ATTENDANCE_PUNCH_RECORDED, (event) => {
        received = true;
        expect(event.payload.type).toBe("IN");
      });

      const event = createDomainEvent({
        name: DomainEventNames.ATTENDANCE_PUNCH_RECORDED,
        tenantId: "tenant_alpha",
        aggregateId: "punch_1",
        aggregateType: "attendance",
        payload: { type: "IN", employeeId: "emp_1" },
      });

      const count = await eventBus.publish(event);
      expect(count).toBe(1);
      expect(received).toBe(true);
    });

    it("routes events matching domain wildcard patterns (e.g. finance.*)", async () => {
      const captured: string[] = [];

      eventBus.subscribe("finance.*", (event) => {
        captured.push(event.name);
      });

      const invoiceEvent = createDomainEvent({
        name: DomainEventNames.FINANCE_INVOICE_ISSUED,
        tenantId: "tenant_alpha",
        aggregateId: "inv_1",
        aggregateType: "invoice",
        payload: { total: 1000 },
      });

      const paymentEvent = createDomainEvent({
        name: DomainEventNames.FINANCE_PAYMENT_RECORDED,
        tenantId: "tenant_alpha",
        aggregateId: "pay_1",
        aggregateType: "payment",
        payload: { amount: 1000 },
      });

      const ticketEvent = createDomainEvent({
        name: DomainEventNames.WORK_TICKET_CREATED,
        tenantId: "tenant_alpha",
        aggregateId: "tik_1",
        aggregateType: "ticket",
        payload: {},
      });

      await eventBus.publish(invoiceEvent);
      await eventBus.publish(paymentEvent);
      await eventBus.publish(ticketEvent); // Should not match finance.*

      expect(captured).toEqual([
        "finance.invoice.issued.v1",
        "finance.payment.recorded.v1",
      ]);
    });

    it("unsubscribes handlers cleanly when cancel function is called", async () => {
      let callCount = 0;
      const unsubscribe = eventBus.subscribe(DomainEventNames.CRM_LEAD_CREATED, () => {
        callCount++;
      });

      const event = createDomainEvent({
        name: DomainEventNames.CRM_LEAD_CREATED,
        tenantId: "tenant_alpha",
        aggregateId: "lead_1",
        aggregateType: "lead",
        payload: {},
      });

      await eventBus.publish(event);
      expect(callCount).toBe(1);

      unsubscribe();
      await eventBus.publish(event);
      expect(callCount).toBe(1);
    });
  });

  describe("3. Strict Multi-Tenant Boundary Isolation (Negative Gates)", () => {
    it("cross-tenant negative gate: prevents Tenant B subscriber from receiving Tenant A events", async () => {
      let tenantBReceived = false;
      let tenantAReceived = false;

      // Tenant A subscriber
      eventBus.subscribe(
        DomainEventNames.PROJECT_APPROVED,
        () => {
          tenantAReceived = true;
        },
        { tenantId: "tenant_alpha" }
      );

      // Tenant B subscriber
      eventBus.subscribe(
        DomainEventNames.PROJECT_APPROVED,
        () => {
          tenantBReceived = true;
        },
        { tenantId: "tenant_bravo" }
      );

      const eventAlpha = createDomainEvent({
        name: DomainEventNames.PROJECT_APPROVED,
        tenantId: "tenant_alpha",
        aggregateId: "proj_alpha",
        aggregateType: "project",
        payload: { budget: 100000 },
      });

      await eventBus.publish(eventAlpha);

      expect(tenantAReceived).toBe(true);
      expect(tenantBReceived).toBe(false); // CRITICAL: Strict negative cross-tenant isolation
    });

    it("allows global cross-tenant auditors (tenantId: '*') to monitor all tenant events", async () => {
      const observedTenants: string[] = [];

      eventBus.subscribe(
        "*",
        (event) => {
          observedTenants.push(event.tenantId);
        },
        { tenantId: "*" }
      );

      await eventBus.publish(
        createDomainEvent({
          name: DomainEventNames.TENANT_PROVISIONED,
          tenantId: "tenant_alpha",
          aggregateId: "t_alpha",
          aggregateType: "tenant",
          payload: {},
        })
      );

      await eventBus.publish(
        createDomainEvent({
          name: DomainEventNames.TENANT_PROVISIONED,
          tenantId: "tenant_bravo",
          aggregateId: "t_bravo",
          aggregateType: "tenant",
          payload: {},
        })
      );

      expect(observedTenants).toEqual(["tenant_alpha", "tenant_bravo"]);
    });
  });

  describe("4. Idempotent Consumer Deduplication (PRD §11)", () => {
    it("ensures duplicate event deliveries to the same consumer execute exactly once", async () => {
      let executions = 0;

      eventBus.subscribe(
        DomainEventNames.FINANCE_INVOICE_ISSUED,
        () => {
          executions++;
        },
        { consumerName: "invoice-ledger-projection" }
      );

      const event = createDomainEvent({
        name: DomainEventNames.FINANCE_INVOICE_ISSUED,
        tenantId: "tenant_alpha",
        aggregateId: "inv_101",
        aggregateType: "invoice",
        payload: { amount: 500 },
      });

      // Publish original
      await eventBus.publish(event);
      expect(executions).toBe(1);

      // Publish duplicate delivery (same event ID)
      await eventBus.publish(event);
      expect(executions).toBe(1); // Deduped!
    });

    it("allows distinct consumers with separate consumerNames to process the same event", async () => {
      let consumer1Count = 0;
      let consumer2Count = 0;

      eventBus.subscribe(
        DomainEventNames.DOCUMENT_UPLOADED,
        () => {
          consumer1Count++;
        },
        { consumerName: "virus-scanner" }
      );

      eventBus.subscribe(
        DomainEventNames.DOCUMENT_UPLOADED,
        () => {
          consumer2Count++;
        },
        { consumerName: "search-indexer" }
      );

      const event = createDomainEvent({
        name: DomainEventNames.DOCUMENT_UPLOADED,
        tenantId: "tenant_alpha",
        aggregateId: "doc_1",
        aggregateType: "document",
        payload: { filename: "report.pdf" },
      });

      await eventBus.publish(event);

      expect(consumer1Count).toBe(1);
      expect(consumer2Count).toBe(1);
    });
  });

  describe("5. Transactional Outbox Engine & Resilience (PRD §14.2)", () => {
    it("enqueues domain events with PENDING status and initial retry state", () => {
      const event = createDomainEvent({
        name: DomainEventNames.WORKFLOW_APPROVAL_DECIDED,
        tenantId: "tenant_alpha",
        aggregateId: "apr_1",
        aggregateType: "approval",
        payload: { decision: "APPROVED" },
      });

      const msg = outbox.enqueue(event);

      expect(msg.status).toBe("PENDING");
      expect(msg.retryCount).toBe(0);
      expect(msg.maxRetries).toBe(3);
      expect(msg.publishedAt).toBeNull();
      expect(msg.tenantId).toBe("tenant_alpha");
    });

    it("processes pending outbox batches and marks records as PUBLISHED upon success", async () => {
      let publishedEvent: any = null;
      eventBus.subscribe(DomainEventNames.LEAVE_REQUEST_SUBMITTED, (e) => {
        publishedEvent = e;
      });

      const event = createDomainEvent({
        name: DomainEventNames.LEAVE_REQUEST_SUBMITTED,
        tenantId: "tenant_alpha",
        aggregateId: "leave_1",
        aggregateType: "leave",
        payload: { days: 3 },
      });

      outbox.enqueue(event);
      const batchResult = await outbox.processBatch(eventBus);

      expect(batchResult.processed).toBe(1);
      expect(batchResult.published).toBe(1);
      expect(batchResult.failed).toBe(0);

      const summary = outbox.getSummary();
      expect(summary.pending).toBe(0);
      expect(summary.published).toBe(1);
      expect(publishedEvent).not.toBeNull();
      expect(publishedEvent.id).toBe(event.id);
    });

    it("transitions failing messages to DEAD_LETTER after exceeding max retries", () => {
      const event = createDomainEvent({
        name: DomainEventNames.NOTIFICATION_DELIVERY_FAILED,
        tenantId: "tenant_alpha",
        aggregateId: "notif_1",
        aggregateType: "notification",
        payload: {},
      });

      const msg = outbox.enqueue(event);

      // Attempt 1
      outbox.recordFailure(msg.id, "SMTP connection refused");
      let current = outbox.getMessages().find((m) => m.id === msg.id)!;
      expect(current.status).toBe("FAILED");
      expect(current.retryCount).toBe(1);

      // Attempt 2
      outbox.recordFailure(msg.id, "SMTP connection refused");
      current = outbox.getMessages().find((m) => m.id === msg.id)!;
      expect(current.status).toBe("FAILED");
      expect(current.retryCount).toBe(2);

      // Attempt 3 (reaches maxRetries = 3)
      outbox.recordFailure(msg.id, "SMTP timeout");
      current = outbox.getMessages().find((m) => m.id === msg.id)!;
      expect(current.status).toBe("DEAD_LETTER");
      expect(current.lastError).toBe("SMTP timeout");

      // Verify dead letter requeue
      const requeued = outbox.retryDeadLetter(msg.id);
      expect(requeued).toBe(true);
      current = outbox.getMessages().find((m) => m.id === msg.id)!;
      expect(current.status).toBe("PENDING");
      expect(current.retryCount).toBe(0);
    });
  });

  describe("6. Outbox Live API Route Endpoints", () => {
    it("handles GET /api/events/outbox returning summary and message backlog", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/outbox");
      const res = await getOutboxRoute(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBeDefined();
      expect(data.messages).toBeDefined();
      expect(data.recentEvents).toBeDefined();
    });

    it("handles POST /api/events/outbox for demo event enqueuing and batch processing", async () => {
      const demoReq = new NextRequest("http://localhost:3000/api/events/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish_demo", tenantId: "tenant_demo" }),
      });

      const demoRes = await postOutboxRoute(demoReq);
      expect(demoRes.status).toBe(200);
      const demoData = await demoRes.json();
      expect(demoData.success).toBe(true);
      expect(demoData.action).toBe("publish_demo");

      const processReq = new NextRequest("http://localhost:3000/api/events/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      });

      const processRes = await postOutboxRoute(processReq);
      expect(processRes.status).toBe(200);
      const processData = await processRes.json();
      expect(processData.success).toBe(true);
      expect(processData.result.processed).toBeGreaterThanOrEqual(1);
    });
  });
});
