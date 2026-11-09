import { describe, it, expect, beforeEach } from "vitest";
import {
  NotificationHub,
  AppNotification,
} from "../lib/notifications";
import {
  DomainEventBus,
  createDomainEvent,
  DomainEventNames,
} from "@opsengine/domain-events";
import {
  GET as getNotificationsRoute,
  POST as postNotificationsRoute,
  PATCH as patchNotificationsRoute,
} from "../app/api/notifications/route";
import { NextRequest } from "next/server";

describe("Real-Time Server-Sent Events (SSE) & Notification Push Stream (PRD Module 15 & §11)", () => {
  let hub: NotificationHub;
  let testEventBus: DomainEventBus;

  beforeEach(() => {
    testEventBus = new DomainEventBus();
    hub = new NotificationHub();
    hub.reset();
  });

  describe("1. SSE Wire Protocol Framing & Connection Handshake", () => {
    it("formats SSE chunks according to W3C Server-Sent Events specification", () => {
      const chunk = NotificationHub.formatSse("notification", {
        title: "Hello",
        unreadCount: 1,
      });

      expect(chunk).toBe('event: notification\ndata: {"title":"Hello","unreadCount":1}\n\n');
    });

    it("registers active client stream and dispatches initial handshake event", () => {
      const chunks: string[] = [];

      const { id, unsubscribe } = hub.register({
        tenantId: "tenant_alpha",
        userId: "usr_100",
        enqueue: (c) => chunks.push(c),
        close: () => {},
      });

      expect(id).toBeDefined();
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain("event: connected");
      expect(chunks[0]).toContain('"tenantId":"tenant_alpha"');
      expect(hub.getActiveConnectionCount("tenant_alpha")).toBe(1);

      unsubscribe();
      expect(hub.getActiveConnectionCount("tenant_alpha")).toBe(0);
    });
  });

  describe("2. Strict Multi-Tenant Boundary Isolation (Negative Gates)", () => {
    it("cross-tenant negative gate: prevents Tenant B client from receiving Tenant A notification stream", () => {
      const alphaChunks: string[] = [];
      const bravoChunks: string[] = [];

      // Tenant Alpha client
      hub.register({
        tenantId: "tenant_alpha",
        userId: "usr_alpha",
        enqueue: (c) => alphaChunks.push(c),
        close: () => {},
      });

      // Tenant Bravo client
      hub.register({
        tenantId: "tenant_bravo",
        userId: "usr_bravo",
        enqueue: (c) => bravoChunks.push(c),
        close: () => {},
      });

      // Reset initial handshake chunks
      alphaChunks.length = 0;
      bravoChunks.length = 0;

      // Dispatch notification strictly for Tenant Alpha
      const notif: AppNotification = {
        id: "notif_alpha_1",
        tenantId: "tenant_alpha",
        title: "Confidential Quarterly Financial Review",
        message: "Financial reports ready for approval",
        category: "FINANCE",
        severity: "CRITICAL",
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      const delivered = hub.dispatch(notif);

      expect(delivered).toBe(1);
      expect(alphaChunks.length).toBe(1);
      expect(alphaChunks[0]).toContain("Confidential Quarterly Financial Review");

      // CRITICAL: Tenant Bravo connection must NOT receive Tenant Alpha notification
      expect(bravoChunks.length).toBe(0);
    });

    it("delivers user-targeted notifications only to the specified recipient within a tenant", () => {
      const user1Chunks: string[] = [];
      const user2Chunks: string[] = [];

      hub.register({
        tenantId: "tenant_alpha",
        userId: "usr_alice",
        enqueue: (c) => user1Chunks.push(c),
        close: () => {},
      });

      hub.register({
        tenantId: "tenant_alpha",
        userId: "usr_bob",
        enqueue: (c) => user2Chunks.push(c),
        close: () => {},
      });

      user1Chunks.length = 0;
      user2Chunks.length = 0;

      // Dispatch targeting Alice only
      hub.dispatch({
        id: "notif_alice",
        tenantId: "tenant_alpha",
        userId: "usr_alice",
        title: "Private Leave Approval",
        message: "Your leave request was approved",
        category: "ATTENDANCE",
        severity: "SUCCESS",
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      expect(user1Chunks.length).toBe(1);
      expect(user1Chunks[0]).toContain("Private Leave Approval");
      expect(user2Chunks.length).toBe(0); // Bob receives nothing
    });
  });

  describe("3. Domain Events Bridge & Notification Mapping (PRD §11 & Module 15)", () => {
    it("automatically dispatches real-time notification when approval is created", async () => {
      const chunks: string[] = [];
      hub.register({
        tenantId: "tenant_alpha",
        userId: "usr_lead",
        enqueue: (c) => chunks.push(c),
        close: () => {},
      });

      chunks.length = 0;

      // Bind hub to testEventBus
      hub.bindDomainEvents(testEventBus);

      // Publish domain event
      const approvalEvent = createDomainEvent({
        name: DomainEventNames.WORKFLOW_APPROVAL_CREATED,
        tenantId: "tenant_alpha",
        aggregateId: "apr_99",
        aggregateType: "approval",
        payload: { title: "Annual IT Security Budget Approval" },
      });

      await testEventBus.publish(approvalEvent);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain("New Approval Required");
      expect(chunks[0]).toContain("Annual IT Security Budget Approval");
      expect(chunks[0]).toContain('"category":"APPROVAL"');
    });

    it("automatically dispatches real-time notification when ticket is assigned", async () => {
      const chunks: string[] = [];
      hub.register({
        tenantId: "tenant_alpha",
        userId: "usr_dev",
        enqueue: (c) => chunks.push(c),
        close: () => {},
      });

      chunks.length = 0;
      hub.bindDomainEvents(testEventBus);

      const ticketEvent = createDomainEvent({
        name: DomainEventNames.WORK_TICKET_ASSIGNED,
        tenantId: "tenant_alpha",
        aggregateId: "tik_501",
        aggregateType: "ticket",
        payload: {
          title: "Fix PostgreSQL Connection Pool Leak",
          assignedToUserId: "usr_dev",
        },
      });

      await testEventBus.publish(ticketEvent);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain("Work Ticket Assigned");
      expect(chunks[0]).toContain("Fix PostgreSQL Connection Pool Leak");
      expect(chunks[0]).toContain('"category":"TICKET"');
    });
  });

  describe("4. Heartbeat Keep-Alive & Unread Management", () => {
    it("broadcasts heartbeat keep-alive frames across all connected streams", () => {
      const client1: string[] = [];
      const client2: string[] = [];

      hub.register({
        tenantId: "tenant_alpha",
        userId: "u1",
        enqueue: (c) => client1.push(c),
        close: () => {},
      });
      hub.register({
        tenantId: "tenant_bravo",
        userId: "u2",
        enqueue: (c) => client2.push(c),
        close: () => {},
      });

      client1.length = 0;
      client2.length = 0;

      const sent = hub.sendHeartbeat();
      expect(sent).toBe(2);
      expect(client1[0]).toContain("event: heartbeat");
      expect(client2[0]).toContain("event: heartbeat");
    });

    it("marks notifications as read and broadcasts badge_update frame", () => {
      const clientChunks: string[] = [];
      hub.register({
        tenantId: "tenant_alpha",
        userId: "u1",
        enqueue: (c) => clientChunks.push(c),
        close: () => {},
      });

      hub.dispatch({
        id: "notif_1",
        tenantId: "tenant_alpha",
        title: "Test Alert",
        message: "Message",
        category: "SYSTEM",
        severity: "INFO",
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      clientChunks.length = 0;

      const result = hub.markAsRead("tenant_alpha", "notif_1");
      expect(result.updatedCount).toBe(1);
      expect(result.unreadCount).toBe(0);

      // Verify badge_update frame pushed to client
      expect(clientChunks.length).toBe(1);
      expect(clientChunks[0]).toContain("event: badge_update");
      expect(clientChunks[0]).toContain('"unreadCount":0');
    });
  });

  describe("5. REST API Route Integration", () => {
    it("handles POST /api/notifications to dispatch notification and GET to list notifications", async () => {
      const postReq = new NextRequest("http://localhost:3000/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "tenant_api_test",
        },
        body: JSON.stringify({
          title: "System Maintenance Notice",
          message: "Planned downtime on Saturday",
          category: "SYSTEM",
          severity: "WARNING",
        }),
      });

      const postRes = await postNotificationsRoute(postReq);
      expect(postRes.status).toBe(200);
      const postData = await postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.notification.title).toBe("System Maintenance Notice");

      const getReq = new NextRequest(
        "http://localhost:3000/api/notifications?tenantId=tenant_api_test"
      );
      const getRes = await getNotificationsRoute(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.unreadCount).toBeGreaterThanOrEqual(1);
      expect(getData.notifications.some((n: any) => n.title === "System Maintenance Notice")).toBe(
        true
      );

      // PATCH mark as read
      const patchReq = new NextRequest("http://localhost:3000/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "tenant_api_test",
        },
        body: JSON.stringify({
          notificationId: postData.notification.id,
        }),
      });

      const patchRes = await patchNotificationsRoute(patchReq);
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.success).toBe(true);
      expect(patchData.updatedCount).toBe(1);
    });
  });
});
