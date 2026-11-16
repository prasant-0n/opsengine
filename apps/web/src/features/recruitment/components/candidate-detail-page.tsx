"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import { CANDIDATE_STATUSES, canTransitionCandidate } from "@/features/recruitment/lib/recruitment";

interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  source: string | null;
  resumeUrl: string | null;
  consentGiven: boolean;
  consentAt: string | null;
  status: string;
  linkedRequisitionId: string | null;
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

function statusBadge(status: string): string {
  switch (status) {
    case "accepted":
      return "badge badge-tertiary";
    case "offer_made":
    case "screening":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { can } = useShell();
  const [row, setRow] = useState<Candidate | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ats/candidates/${id}`);
      if (res.status === 403) return setState("denied");
      if (res.status === 404) return setState("notfound");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRow(data.candidate);
      setHistory(data.history ?? []);
      setNotes(data.candidate?.notes ?? "");
      setState("ok");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const nextStatuses = row
    ? CANDIDATE_STATUSES.filter((s) => s !== row.status && canTransitionCandidate(row.status as any, s as any))
    : [];

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/ats/candidates/${id}`, {
        method: "PATCH",
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
          <h1 className="font-headline-lg">Candidate</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">lock</span>
            <p className="state-panel-title">Permission denied</p>
            <p className="state-panel-note mono">missing: recruit.candidate.read</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">Candidate</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-title">Not found</p>
            <p className="state-panel-note">This candidate does not exist in your tenant.</p>
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
          <h1 className="font-headline-lg">Candidate</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-body animate-pulse">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  const canUpdate = can("recruit.candidate.update");
  const terminal = ["rejected", "withdrawn", "accepted"].includes(row.status);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="font-headline-lg">{row.fullName}</h1>
          <p className="page-subtitle">
            <Link href="/dashboard/recruit" className="link-plain">Recruitment</Link>
            {" / "}candidate
          </p>
        </div>
        <span className={statusBadge(row.status)}>{row.status.replace("_", " ")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Profile</h2>
          </div>
          <div style={{ padding: 16, display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
              <span className="font-label-sm">Email</span>
              <span className="mono">{row.email}</span>
              <span className="font-label-sm">Phone</span>
              <span className="mono">{row.phone ?? "—"}</span>
              <span className="font-label-sm">Source</span>
              <span>{row.source ?? "—"}</span>
              <span className="font-label-sm">Resume</span>
              <span className="mono">{row.resumeUrl ?? "—"}</span>
              <span className="font-label-sm">Consent</span>
              <span>
                {row.consentGiven
                  ? `given${row.consentAt ? ` @ ${new Date(row.consentAt).toISOString()}` : ""}`
                  : "not recorded"}
              </span>
              <span className="font-label-sm">Added</span>
              <span className="mono">{new Date(row.createdAt).toLocaleString()}</span>
            </div>

            {canUpdate ? (
              <>
                <label className="font-label-sm" style={{ marginTop: 8 }}>
                  Notes
                  <textarea
                    className="input input-sm"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <div className="badge-row">
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={busy || notes === (row.notes ?? "")}
                    onClick={() => act({ notes })}
                  >
                    Save notes
                  </button>
                </div>
              </>
            ) : row.notes ? (
              <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{row.notes}</p>
            ) : null}
          </div>

          <div className="panel-header" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <h2 className="panel-title">Pipeline history</h2>
            <span className="state-panel-note mono">stage_history</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Reason</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="mono">{h.fromStatus ?? "—"}</td>
                    <td className="mono">{h.toStatus}</td>
                    <td>{h.reason ?? "—"}</td>
                    <td className="mono">{new Date(h.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No transitions yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Actions</h2>
          </div>
          <div style={{ padding: 16, display: "grid", gap: 8 }}>
            {actionError ? <p className="state-panel-note mono">{actionError}</p> : null}

            {canUpdate && nextStatuses.length > 0 ? (
              <>
                <span className="font-label-sm">Move to</span>
                <div className="badge-row">
                  {nextStatuses.map((s) => (
                    <button
                      key={s}
                      className="btn btn-outline btn-sm"
                      disabled={busy}
                      onClick={() => act({ status: s })}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {terminal ? (
              <p className="state-panel-note">Terminal state — no further transitions.</p>
            ) : null}

            {!canUpdate ? (
              <p className="state-panel-note mono">missing: recruit.candidate.update</p>
            ) : null}

            <p className="state-panel-note">
              Rejection is a human decision — the system never auto-rejects (PRD §3).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
