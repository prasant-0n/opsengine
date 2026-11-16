"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";

interface Interview {
  id: string;
  candidateId: string | null;
  requisitionId: string | null;
  type: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location: string | null;
  meetingLink: string | null;
  status: string;
  createdAt: string;
}

interface PanelRow {
  id: string;
  employeeId: string;
  role: string;
}

interface FeedbackRow {
  id: string;
  interviewerId: string;
  rating: number;
  notes: string | null;
  createdAt: string;
}

interface HistoryRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

const OUTCOME_STATUSES = ["completed", "cancelled", "no_show"] as const;

function statusBadge(status: string): string {
  switch (status) {
    case "completed":
      return "badge badge-tertiary";
    case "scheduled":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InterviewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { can } = useShell();
  const [row, setRow] = useState<Interview | null>(null);
  const [panel, setPanel] = useState<PanelRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fb, setFb] = useState({ interviewerId: "", rating: "4", notes: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ats/interviews/${id}`);
      if (res.status === 403) return setState("denied");
      if (res.status === 404) return setState("notfound");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRow(data.interview);
      setPanel(data.panel ?? []);
      setFeedback(data.feedback ?? []);
      setHistory(data.history ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (state === "denied") {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">Interview</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">lock</span>
            <p className="state-panel-title">Permission denied</p>
            <p className="state-panel-note mono">missing: recruit.interview.read</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">Interview</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-title">Not found</p>
            <p className="state-panel-note">This interview does not exist in your tenant.</p>
            <Link href="/dashboard/recruit" className="link-plain">Back to recruitment</Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error" || !row) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">Interview</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-body animate-pulse">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  const canDecide = can("recruit.interview.decide");
  const canFeedback = can("recruit.interview.feedback");
  const isScheduled = row.status === "scheduled";
  const avg = feedback.length
    ? (feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length).toFixed(1)
    : null;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="font-headline-lg">Interview · {row.type}</h1>
          <p className="page-subtitle">
            <Link href="/dashboard/recruit" className="link-plain">Recruitment</Link>
            {" / "}interview
          </p>
        </div>
        <span className={statusBadge(row.status)}>{row.status}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Schedule</h2>
          </div>
          <div style={{ padding: 16, display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
              <span className="font-label-sm">Starts</span>
              <span className="mono">{fmt(row.startAt)}</span>
              <span className="font-label-sm">Ends</span>
              <span className="mono">{fmt(row.endAt)}</span>
              <span className="font-label-sm">Timezone</span>
              <span className="mono">{row.timezone}</span>
              <span className="font-label-sm">Location / link</span>
              <span className="mono">{row.meetingLink ?? row.location ?? "—"}</span>
            </div>
          </div>

          <div className="panel-header" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <h2 className="panel-title">Panel</h2>
            <span className="font-label-sm mono">{panel.length} member{panel.length === 1 ? "" : "s"}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                {panel.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/dashboard/people/${p.employeeId}`} className="link-plain mono">
                        {p.employeeId.slice(0, 8)}…
                      </Link>
                    </td>
                    <td>{p.role}</td>
                  </tr>
                ))}
                {panel.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No panel members assigned.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="panel-header" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <h2 className="panel-title">Status history</h2>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="mono">{h.fromStatus ?? "—"}</td>
                    <td className="mono">{h.toStatus}</td>
                    <td className="mono">{new Date(h.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No transitions yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Outcome</h2>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 8 }}>
              {actionError ? <p className="state-panel-note mono">{actionError}</p> : null}
              {canDecide && isScheduled ? (
                <>
                  <span className="font-label-sm">Record outcome</span>
                  <div className="badge-row">
                    {OUTCOME_STATUSES.map((s) => (
                      <button
                        key={s}
                        className={s === "completed" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
                        disabled={busy}
                        onClick={() => act(`/api/ats/interviews/${id}/outcome`, { status: s })}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </>
              ) : !isScheduled ? (
                <p className="state-panel-note">Outcome already recorded ({row.status}).</p>
              ) : (
                <p className="state-panel-note mono">missing: recruit.interview.decide</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Feedback</h2>
              <span className="font-label-sm mono">
                {avg ? `avg ${avg}` : "no ratings"}
              </span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Interviewer</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Notes</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((f) => (
                    <tr key={f.id}>
                      <td className="mono">{f.interviewerId.slice(0, 8)}…</td>
                      <td className="mono">{f.rating}/5</td>
                      <td>{f.notes ?? "—"}</td>
                      <td className="mono">{new Date(f.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {feedback.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No feedback submitted yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {canFeedback && isScheduled ? (
              <div style={{ padding: 16, borderTop: "1px solid hsl(var(--border))", display: "grid", gap: 8 }}>
                <label className="font-label-sm">
                  Interviewer
                  <select
                    className="input input-sm"
                    value={fb.interviewerId}
                    onChange={(e) => setFb({ ...fb, interviewerId: e.target.value })}
                  >
                    <option value="">— select panel member —</option>
                    {panel.map((p) => (
                      <option key={p.id} value={p.employeeId}>
                        {p.employeeId.slice(0, 8)}… ({p.role})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="font-label-sm">
                  Rating (1–5)
                  <select
                    className="input input-sm"
                    value={fb.rating}
                    onChange={(e) => setFb({ ...fb, rating: e.target.value })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="font-label-sm">
                  Notes
                  <textarea
                    className="input input-sm"
                    rows={2}
                    value={fb.notes}
                    onChange={(e) => setFb({ ...fb, notes: e.target.value })}
                  />
                </label>
                <div className="badge-row">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy || !fb.interviewerId}
                    onClick={() =>
                      act(`/api/ats/interviews/${id}/feedback`, {
                        interviewerId: fb.interviewerId,
                        rating: parseInt(fb.rating),
                        notes: fb.notes || null,
                      })
                    }
                  >
                    Submit feedback
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
