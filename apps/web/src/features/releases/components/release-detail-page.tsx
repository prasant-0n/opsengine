"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import { RELEASE_GATE_STATUSES } from "../lib/releases";

function statusBadge(status: string): string {
  switch (status) {
    case "deployed":
    case "passed":
      return "badge badge-tertiary";
    case "approved":
      return "badge badge-primary";
    case "review":
      return "badge badge-outline";
    case "failed":
    case "rolled_back":
    case "cancelled":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function ReleaseDetailPage() {
  const { can } = useShell();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canManageGates = can("release.gate.manage");
  const canApprove = can("release.approve");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/releases/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateGate(gateId: string, status: string, notes?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/releases/${id}/gates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateId, status, notes }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(url: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page-stack"><div className="state-panel state-panel-empty">Loading…</div></div>;
  if (!data) return <div className="page-stack"><div className="state-panel state-panel-error">{error ?? "Not found"}</div></div>;

  const release = data.release;
  const gates = release.gates ?? [];

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1 className="mono">{release.number}</h1>
          <p className="muted">
            {release.title} · <span className={statusBadge(release.status)}>{release.status}</span> · Environment: <strong>{release.targetEnv}</strong>
          </p>
        </div>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Deployment Gates</h2>
          <p className="muted">All mandatory gates (QA, Security, Change Management, Technical) must pass or be waived before approval.</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Gate Type</th>
              <th>Status</th>
              <th>Checked At</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {gates.map((g: any) => (
              <tr key={g.id}>
                <td className="mono uppercase">{g.gateType}</td>
                <td>
                  <span className={statusBadge(g.status)}>{g.status}</span>
                </td>
                <td className="mono">{g.checkedAt ? new Date(g.checkedAt).toLocaleString() : "—"}</td>
                <td>{g.notes ?? "—"}</td>
                <td>
                  {canManageGates && (
                    <div className="inline-form" style={{ gap: "0.25rem" }}>
                      {RELEASE_GATE_STATUSES.map((st) => (
                        <button
                          key={st}
                          className={`link ${g.status === st ? "font-bold" : ""}`}
                          disabled={busy}
                          onClick={() => updateGate(g.id, st, g.notes)}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Release Actions</h2>
        </div>
        <div className="action-row">
          {release.status === "draft" && canApprove && (
            <button className="btn btn-primary" disabled={busy} onClick={() => act(`/api/releases/${id}/approve`)}>
              Approve Release (Verify Gates)
            </button>
          )}
          {release.status === "approved" && canApprove && (
            <button className="btn btn-primary" disabled={busy} onClick={() => act(`/api/releases/${id}/deploy`)}>
              Deploy to {release.targetEnv}
            </button>
          )}
          {release.status === "deployed" && <p className="muted">Release successfully deployed on {new Date(release.deployedAt).toLocaleString()}</p>}
        </div>
        {release.rollbackPlan && (
          <p className="muted" style={{ marginTop: "1rem" }}>
            <strong>Rollback Plan:</strong> {release.rollbackPlan}
          </p>
        )}
      </div>
    </div>
  );
}
