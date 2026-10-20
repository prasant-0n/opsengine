"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=1", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000); // poll every 30s
    return () => clearInterval(interval);
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    await load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await load();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn btn-secondary"
        style={{ position: "relative", padding: "0.5rem 0.75rem" }}
        onClick={() => setOpen((s) => !s)}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              background: "#ef4444",
              color: "#fff",
              borderRadius: "50%",
              padding: "0.1rem 0.4rem",
              fontSize: "0.7rem",
              fontWeight: "bold",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "120%",
            width: "320px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid #334155", paddingBottom: "0.5rem" }}>
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button className="link" onClick={markAllRead} style={{ fontSize: "0.8rem" }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {notifications.length === 0 ? (
              <p className="muted" style={{ textAlign: "center", padding: "1rem" }}>No unread notifications.</p>
            ) : (
              notifications.map((n: any) => (
                <div key={n.id} style={{ padding: "0.5rem", background: "#1e293b", borderRadius: "6px", border: "1px solid #334155" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: "0.85rem" }}>{n.title}</strong>
                    <button className="link" onClick={() => markRead(n.id)} style={{ fontSize: "0.75rem" }}>✓</button>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>{n.body}</p>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: "0.75rem", textAlign: "center", borderTop: "1px solid #334155", paddingTop: "0.5rem" }}>
            <Link href="/dashboard/notifications" className="link" onClick={() => setOpen(false)} style={{ fontSize: "0.85rem" }}>
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
