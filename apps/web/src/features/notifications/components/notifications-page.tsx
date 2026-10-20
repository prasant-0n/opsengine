"use client";

import { useCallback, useEffect, useState } from "react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="muted">All in-app alerts and updates</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={markAllRead}>
            Mark all read
          </button>
        </div>
      </header>

      <div className="panel">
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="state-panel state-panel-empty">No notifications.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Title</th>
                <th>Message</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td>
                    <span className="badge badge-outline">{n.category}</span>
                  </td>
                  <td><strong>{n.title}</strong></td>
                  <td>{n.body}</td>
                  <td className="mono">{new Date(n.createdAt).toLocaleString()}</td>
                  <td>
                    {n.readAt ? (
                      <span className="muted">Read</span>
                    ) : (
                      <button className="link" onClick={() => markRead(n.id)}>
                        Mark read
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
