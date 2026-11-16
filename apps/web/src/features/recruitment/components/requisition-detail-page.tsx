"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import {
  REQUISITION_STATUSES,
  canTransitionRequisition,
} from "@/features/recruitment/lib/recruitment";

interface Requisition {
  id: string;
  jobTitle: string;
  jobFamily: string | null;
  grade: string | null;
  headcount: number;
  budgetBand: string | null;
  hiringManagerId: string | null;
  justification: string | null;
  expectedStartDate: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface HistoryRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
}

function statusBadge(status: string): string {
  switch (status) {
    case "approved":
      return "badge badge-tertiary";
    case "submitted":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

export default function RequisitionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { can } = useShell();
  const [row, setRow] = useState<Requisition | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ats/requisitions/${id}`);
      if (res.status === 403) return setState("denied");
      if (res.status === 404) return setState("notfound");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRow(data.requisition);
      setHistory(data.history ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // approved/rejected are governed decisions — reachable only via POST /approve (audited)
  const nextStatuses = row
    ? REQUISITION_STATUSES.filter(
        (s) =>
          s !== row.status &&
          s !== "approved" &&
          s !== "rejected" &&
          canTransitionRequisition(row.status as any, s as any),
      )
    : [];

  const act = async (body: Record<string, unknown>, path?: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(path ?? `/api/ats/requisitions/${id}`, {
        method: path ? "POST" : "PATCH",
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
          <h1 className="font-headline-lg">Requisition</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">lock</span>
            <p className="state-panel-title">Permission denied</p>
            <p className="state-panel-note mono">missing: recruit.requisition.read</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">Requisition</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-title">Not found</p>
            <p className="state-panel-note">This requisition does not exist in your tenant.</p>
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
          <h1 className="font-headline-lg">Requisition</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-body animate-pulse">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  const canApprove = can("recruit.requisition.approve");
  const canUpdate = can("recruit.requisition.update");

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="font-headline-lg">{row.jobTitle}</h1>
          <p className="page-subtitle">
            <Link href="/dashboard/recruit" className="link-plain">Recruitment</Link>
            {" / "}requisition
          </p>
        </div>
        <span className={statusBadge(row.status)}>{row.status}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Details</h2>
          </div>
          <div style={{ padding: 16, display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
              <span className="font-label-sm">Job family</span>
              <span>{row.jobFamily ?? "—"}</span>
              <span className="font-label-sm">Grade</span>
              <span className="mono">{row.grade ?? "—"}</span>
              <span className="font-label-sm">Headcount</span>
              <span className="mono">{row.headcount}</span>
              <span className="font-label-sm">Budget band</span>
              <span className="mono">{row.budgetBand ?? "—"}</span>
              <span className="font-label-sm">Expected start</span>
              <span className="mono">{row.expectedStartDate ? new Date(row.expectedStartDate).toLocaleDateString() : "—"}</span>
              <span className="font-label-sm">Created</span>
              <span className="mono">{new Date(row.createdAt).toLocaleString()}</span>
              <span className="font-label-sm">Approved</span>
              <span className="mono">{row.approvedAt ? new Date(row.approvedAt).toLocaleString() : "—"}</span>
              <span className="font-label-sm">Justification</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{row.justification ?? "—"}</span>
            </div>
          </div>

          <div className="panel-header" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <h2 className="panel-title">Workflow</h2>
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
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {canApprove && row.status === "submitted" ? (
              <>
                <span className="font-label-sm">Governed approval (audit-logged)</span>
                <div className="badge-row">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => act({ action: "approve" }, `/api/ats/requisitions/${id}/approve`)}
                  >
                    Approve requisition
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => act({ action: "reject" }, `/api/ats/requisitions/${id}/approve`)}
                  >
                    Reject
                  </button>
                </div>
              </>
            ) : null}

            {!canUpdate && !canApprove ? (
              <p className="state-panel-note mono">missing: recruit.requisition.update / approve</p>
            ) : null}

            {row.status === "approved" ? (
              <p className="state-panel-note">Approved requisitions can proceed to candidate sourcing.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
