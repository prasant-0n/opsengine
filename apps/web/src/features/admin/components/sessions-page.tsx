"use client";

import { useCallback, useEffect, useState } from "react";

interface SessionRow {
  id: string;
  createdAt: string;
  current: boolean;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/auth/sessions");
      if (!res.ok) throw new Error();
      setSessions((await res.json()).sessions ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(id: string) {
    await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="font-headline-lg">Sessions</h1>
          <p className="page-subtitle">session.manage_self · revoke any device</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Active sessions</h2>
        </div>
        {state === "loading" ? (
          <div className="panel-empty">
            <p className="state-panel-body animate-pulse">Loading…</p>
          </div>
        ) : state === "error" ? (
          <div className="panel-empty">
            <p className="state-panel-title">Failed to load sessions</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={load}>
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="panel-empty">
            <p className="state-panel-body">No sessions.</p>
          </div>
        ) : (
          <ul className="session-list" style={{ padding: "0.75rem 1rem" }}>
            {sessions.map((s) => (
              <li key={s.id} className="session-item">
                <span className="session-meta">
                  {new Date(s.createdAt).toLocaleString()}
                  {s.current ? " · current" : ""}
                </span>
                {!s.current && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => revoke(s.id)}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
