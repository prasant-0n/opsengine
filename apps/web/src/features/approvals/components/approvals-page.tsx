"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";

type View = "assigned" | "requested" | "all";

function statusBadge(status: string): string {
  switch (status) {
    case "approved":
      return "badge badge-tertiary";
    case "rejected":
      return "badge badge-error";
    case "cancelled":
      return "badge badge-outline";
    case "pending":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

export default function ApprovalsPage() {
  const { can } = useShell();
  const [view, setView] = useState<View>("assigned");
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSeeAll = can("approval.read"); // tenant-scoped read surfaces the "All" tab

  const load = useCallback(
    async (v: View) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/approvals/instances?view=${v}`, { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Failed (${res.status})`);
          setInstances([]);
          return;
        }
        const data = await res.json();
        setInstances(data.instances ?? []);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(view);
  }, [view, load]);

  const overdueCount = instances.filter((i) => i.overdue).length;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Approvals</h1>
          <p className="muted mono">approval.read · decision inbox</p>
        </div>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="tabs">
        <button className={`tab ${view === "assigned" ? "tab-active" : ""}`} onClick={() => setView("assigned")}>
          Assigned to me{overdueCount > 0 && view === "assigned" ? ` (${overdueCount} overdue)` : ""}
        </button>
        <button className={`tab ${view === "requested" ? "tab-active" : ""}`} onClick={() => setView("requested")}>
          Requested by me
        </button>
        {canSeeAll && (
          <button className={`tab ${view === "all" ? "tab-active" : ""}`} onClick={() => setView("all")}>
            All
          </button>
        )}
      </div>

      <div className="panel">
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : instances.length === 0 ? (
          <div className="state-panel state-panel-empty">No approval requests.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Requester</th>
                <th>Step</th>
                <th>Status</th>
                <th>Due</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/dashboard/approvals/${i.id}`} className="mono">
                      {i.subjectType} · {String(i.subjectId).slice(0, 8)}
                    </Link>
                    {i.amountCents && <div className="muted mono">${(Number(i.amountCents) / 100).toFixed(2)}</div>}
                  </td>
                  <td className="mono">{String(i.requesterEmployeeId).slice(0, 8)}</td>
                  <td>{i.currentStepNumber}</td>
                  <td>
                    <span className={statusBadge(i.status)}>{i.status}</span>
                  </td>
                  <td className="mono">
                    {i.dueAt ? new Date(i.dueAt).toISOString().slice(0, 10) : "—"}
                    {i.overdue && <span className="badge badge-error">overdue</span>}
                  </td>
                  <td className="mono">{new Date(i.updatedAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
