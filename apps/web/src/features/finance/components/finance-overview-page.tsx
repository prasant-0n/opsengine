"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "../lib/finance";

function agingBadge(bucket: string): string {
  switch (bucket) {
    case "current":
      return "badge badge-tertiary";
    case "days1_30":
      return "badge badge-primary";
    case "days31_60":
      return "badge badge-outline";
    case "days61_90":
      return "badge badge-error";
    default:
      return "badge badge-error";
  }
}

export default function FinanceOverviewPage() {
  const [receivables, setReceivables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/receivables`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setReceivables(data.receivables ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = receivables.filter((r) => r.outstandingCents !== "0");
  const overdue = open.filter((r) => r.overdue);
  const disputes = receivables.filter((r) => r.disputeStatus === "raised");
  const outstandingTotal = open.reduce((acc, r) => acc + Number(r.outstandingCents), 0);
  const overdueTotal = overdue.reduce((acc, r) => acc + Number(r.outstandingCents), 0);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="muted mono">finance.invoice.read · client receivables</p>
        </div>
        <div className="action-row">
          <Link href="/dashboard/finance/invoices" className="btn btn-secondary">
            Invoices
          </Link>
          <Link href="/dashboard/finance/receivables" className="btn btn-secondary">
            Receivables
          </Link>
        </div>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="form-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Outstanding</h2>
          </div>
          <p className="mono" style={{ fontSize: 24 }}>{formatMoney(outstandingTotal)}</p>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Overdue</h2>
          </div>
          <p className="mono" style={{ fontSize: 24 }}>
            {overdue.length} · {formatMoney(overdueTotal)}
          </p>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Open receivables</h2>
          </div>
          <p className="mono" style={{ fontSize: 24 }}>{open.length}</p>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Disputes</h2>
          </div>
          <p className="mono" style={{ fontSize: 24 }}>{disputes.length}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Overdue receivables</h2>
        </div>
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : overdue.length === 0 ? (
          <div className="state-panel state-panel-empty">No overdue receivables.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Due</th>
                <th>Outstanding</th>
                <th>Aging</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/dashboard/finance/invoices/${r.invoiceId}`} className="mono">
                      {r.invoiceNumber}
                    </Link>
                  </td>
                  <td className="mono">{r.dueOn ? new Date(r.dueOn).toISOString().slice(0, 10) : "—"}</td>
                  <td className="mono">{formatMoney(r.outstandingCents, r.currency)}</td>
                  <td>
                    <span className={agingBadge(r.agingBucket)}>{r.agingBucket}</span>
                  </td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
