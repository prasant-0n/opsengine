"use client";

import React, { useState, useEffect } from "react";
import { Bell, BellOff, Send, CheckCircle2, AlertCircle } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
    } catch (_err) {
      // Ignore in environments where pushManager is unsupported
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      // Request browser permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        throw new Error("Notification permission was denied.");
      }

      // Fetch public VAPID key
      const keyRes = await fetch("/api/notifications/push/vapid-public-key");
      if (!keyRes.ok) {
        throw new Error("Failed to retrieve server VAPID key.");
      }
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      const convertedKey = urlBase64ToUint8Array(publicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys) {
        throw new Error("Malformed subscription keys received from browser.");
      }

      // Register on server
      const registerRes = await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (!registerRes.ok) {
        const errData = await registerRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to register subscription on server.");
      }

      setIsSubscribed(true);
      setMessage({
        text: "Web Push notifications enabled successfully for this device!",
        type: "success",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enable notifications";
      setMessage({ text: msg, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await fetch("/api/notifications/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }

      setIsSubscribed(false);
      setMessage({
        text: "Push notifications disabled for this device.",
        type: "success",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to unsubscribe";
      setMessage({ text: msg, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/notifications/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "OpsEngine Instant Alert",
          body: "Test push notification delivered via Web Push RFC 8030 / VAPID.",
          url: "/dashboard",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to deliver test notification");
      }

      setMessage({
        text: data.message || "Test push dispatched successfully!",
        type: "success",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to test push";
      setMessage({ text: msg, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Web Push Notifications</h3>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isSubscribed
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              {isSubscribed ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Receive native OS alerts for urgent approvals, ticket escalations, and DAR submissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSubscribed ? (
            <>
              <button
                onClick={handleSendTestPush}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-blue-400" />
                Test Alert
              </button>
              <button
                onClick={handleUnsubscribe}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition disabled:opacity-50"
              >
                <BellOff className="w-3.5 h-3.5" />
                Disable
              </button>
            </>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={isLoading || permission === "denied"}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5" />
              Enable Push
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-xs ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
