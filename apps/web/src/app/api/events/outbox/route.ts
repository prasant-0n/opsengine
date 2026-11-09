import { NextRequest, NextResponse } from "next/server";
import {
  globalTransactionalOutbox,
  globalEventBus,
  createDomainEvent,
  DomainEventNames,
  OutboxMessageStatus,
} from "@opsengine/domain-events";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") || undefined;
  const status = (searchParams.get("status") as OutboxMessageStatus) || undefined;
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const summary = globalTransactionalOutbox.getSummary(tenantId);
  const messages = globalTransactionalOutbox.getMessages({
    tenantId,
    status,
    limit,
  });
  const recentEvents = globalEventBus.getRecentEvents(25, tenantId);

  return NextResponse.json({
    summary,
    messages,
    recentEvents,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "process";
    const batchSize = body.batchSize || 50;

    if (action === "process") {
      const result = await globalTransactionalOutbox.processBatch(globalEventBus, batchSize);
      return NextResponse.json({
        success: true,
        action: "process",
        result,
        summary: globalTransactionalOutbox.getSummary(),
      });
    }

    if (action === "retry_dead_letter") {
      const { messageId } = body;
      if (!messageId) {
        return NextResponse.json(
          { error: "messageId is required for retry_dead_letter" },
          { status: 400 }
        );
      }
      const success = globalTransactionalOutbox.retryDeadLetter(messageId);
      if (!success) {
        return NextResponse.json(
          { error: "Message not found or not in DEAD_LETTER status" },
          { status: 404 }
        );
      }
      const processResult = await globalTransactionalOutbox.processBatch(globalEventBus, batchSize);
      return NextResponse.json({
        success: true,
        action: "retry_dead_letter",
        messageId,
        processResult,
        summary: globalTransactionalOutbox.getSummary(),
      });
    }

    if (action === "publish_demo") {
      const tenantId = body.tenantId || "tenant-default";
      const event = createDomainEvent({
        name: body.name || DomainEventNames.WORKFLOW_APPROVAL_CREATED,
        tenantId,
        aggregateId: body.aggregateId || `agg-${Date.now()}`,
        aggregateType: body.aggregateType || "approval",
        payload: body.payload || {
          title: "Enterprise Annual Budget Approval",
          amount: 250000,
          currency: "USD",
          requestedBy: "lead@example.com",
        },
      });

      const outboxMsg = globalTransactionalOutbox.enqueue(event);
      return NextResponse.json({
        success: true,
        action: "publish_demo",
        enqueuedMessage: outboxMsg,
        summary: globalTransactionalOutbox.getSummary(),
      });
    }

    return NextResponse.json(
      { error: `Unknown action '${action}'. Valid actions: 'process', 'retry_dead_letter', 'publish_demo'` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process outbox operation", details: err?.message },
      { status: 500 }
    );
  }
}
