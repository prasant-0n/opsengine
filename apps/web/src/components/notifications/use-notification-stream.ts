"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AppNotification } from "@/lib/notifications/types";

interface UseNotificationStreamOptions {
  tenantId?: string;
  userId?: string;
  onNotification?: (notification: AppNotification) => void;
}

export function useNotificationStream(options?: UseNotificationStreamOptions) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastNotification, setLastNotification] = useState<AppNotification | null>(null);

  const tenantId = options?.tenantId || "tenant-default";
  const userId = options?.userId;
  const onNotificationRef = useRef(options?.onNotification);
  onNotificationRef.current = options?.onNotification;

  // Initial fetch of unread notifications
  const fetchInitialNotifications = useCallback(async () => {
    try {
      const url = new URL("/api/notifications", window.location.origin);
      url.searchParams.set("tenantId", tenantId);
      if (userId) url.searchParams.set("userId", userId);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }, [tenantId, userId]);

  // Mark notification(s) as read
  const markAsRead = useCallback(
    async (notificationId?: string) => {
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, userId, notificationId }),
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
          setNotifications((prev) =>
            prev.map((n) =>
              !notificationId || n.id === notificationId ? { ...n, isRead: true } : n
            )
          );
        }
      } catch {}
    },
    [tenantId, userId]
  );

  useEffect(() => {
    fetchInitialNotifications();

    if (typeof window === "undefined" || !("EventSource" in window)) {
      return;
    }

    const streamUrl = new URL("/api/notifications/stream", window.location.origin);
    streamUrl.searchParams.set("tenantId", tenantId);
    if (userId) streamUrl.searchParams.set("userId", userId);

    const es = new EventSource(streamUrl.toString());

    es.addEventListener("connected", () => {
      setIsConnected(true);
    });

    es.addEventListener("notification", (e: MessageEvent) => {
      try {
        const notif: AppNotification = JSON.parse(e.data);
        setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
        setUnreadCount((prev) => prev + 1);
        setLastNotification(notif);
        if (onNotificationRef.current) {
          onNotificationRef.current(notif);
        }
      } catch {}
    });

    es.addEventListener("badge_update", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch {}
    });

    es.addEventListener("heartbeat", () => {
      setIsConnected(true);
    });

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [tenantId, userId, fetchInitialNotifications]);

  return {
    notifications,
    unreadCount,
    isConnected,
    lastNotification,
    markAsRead,
    refresh: fetchInitialNotifications,
  };
}
