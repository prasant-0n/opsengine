"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import { formatMoney } from "@/features/finance/lib/finance";

function statusBadge(status: string): string {
  switch (status) {
    case "approved":
      return "badge badge-tertiary";
    case "submitted":
      return "badge badge-primary";
    case "draft":
      return "badge badge-outline";
    case "rejected":
    case "expired":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function ProposalDetailPage() {
  const { can } = useShell();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [lineForm, setLineForm] = useState({ roleTitle: "", hours: 40, hourlyRateCents: 15000 });

  const canCreate = can("presales.proposal.create");
  const canApprove = can("presales.proposal.approve");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/presales/proposals/${id}`, { cache: "no-store" });
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

  async function addLine() {
    if (!lineForm.roleTitle) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/presales/proposals/${id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lineForm),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      setLineForm({ roleTitle: "", hours: 40, hourlyRateCents: 15000 });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function approveProposal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/presales/proposals/${id}/approve`, { method: "POST" });
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

  const proposal = data.proposal;
  const lines = proposal.lines ?? [];

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1 className="mono">{proposal.number}</h1>
          <p className="muted">
            {proposal.title} · <span className={statusBadge(proposal.status)}>{proposal.status}</span> · Margin: {(proposal.marginPct * 100).toFixed(0)}%
          </p>
        </div>
        <p className="mono" style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{formatMoney(proposal.totalAmountCents, proposal.currency)}</p>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Estimate Line Items (Roles & Rates)</h2>
        </div>
        {lines.length === 0 ? (
          <div className="state-panel state-panel-empty">No estimate lines added yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Role Title</th>
                <th>Hours</th>
                <th>Hourly Rate</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any) => (
                <tr key={l.id}>
                  <td>{l.roleTitle}</td>
                  <td className="mono">{l.hours} hrs</td>
                  <td className="mono">{formatMoney(l.hourlyRateCents, proposal.currency)}/hr</td>
                  <td className="mono">{formatMoney(l.totalCents, proposal.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {proposal.status === "draft" && canCreate && (
          <div className="inline-form" style={{ marginTop: "1rem" }}>
            <input className="input" placeholder="Role Title (e.g. Senior Architect)" value={lineForm.roleTitle} onChange={(e) => setLineForm({ ...lineForm, roleTitle: e.target.value })} />
            <input className="input" type="number" placeholder="Hours" value={lineForm.hours} onChange={(e) => setLineForm({ ...lineForm, hours: Number(e.target.value) })} />
            <input className="input" type="number" placeholder="Rate (cents/hr)" value={lineForm.hourlyRateCents} onChange={(e) => setLineForm({ ...lineForm, hourlyRateCents: Number(e.target.value) })} />
            <button className="btn btn-secondary" disabled={busy || !lineForm.roleTitle} onClick={addLine}>
              Add line
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Proposal Actions</h2>
        </div>
        <div className="action-row">
          {proposal.status === "draft" && canApprove && (
            <button className="btn btn-primary" disabled={busy} onClick={approveProposal}>
              Approve Proposal
            </button>
          )}
          {proposal.status === "approved" && <p className="muted">Proposal approved and finalized.</p>}
        </div>
      </div>
    </div>
  );
}
