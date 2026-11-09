import { NextRequest } from "next/server";
import { globalNotificationHub } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Extract tenantId and userId from headers, session cookie, or query params
  const headerTenantId = req.headers.get("x-tenant-id");
  const queryTenantId = searchParams.get("tenantId");
  const cookieSession = req.cookies.get("ops_session")?.value;

  const tenantId = headerTenantId || queryTenantId || "tenant-default";
  const userId = searchParams.get("userId") || (cookieSession ? `user-${cookieSession.slice(0, 8)}` : "user-anonymous");

  const encoder = new TextEncoder();
  let cleanupSubscription: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const { unsubscribe } = globalNotificationHub.register({
        tenantId,
        userId,
        enqueue: (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch (err) {
            // Controller closed or stream error
          }
        },
        close: () => {
          try {
            controller.close();
          } catch {}
        },
      });

      cleanupSubscription = unsubscribe;

      // Handle abort / disconnect signal
      req.signal.addEventListener("abort", () => {
        if (cleanupSubscription) {
          cleanupSubscription();
          cleanupSubscription = null;
        }
      });
    },
    cancel() {
      if (cleanupSubscription) {
        cleanupSubscription();
        cleanupSubscription = null;
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Transfer-Encoding": "chunked",
    },
  });
}
