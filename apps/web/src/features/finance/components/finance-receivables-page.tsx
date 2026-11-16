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
    default:
      return "badge badge-error";
  }
}

const BUCKETS: Array<{ key: string; label: string }> = [
  { key: "current", label: "Current" },
  { key: "days1_30", label: "1-30" },
  { key: "days31_60", label: "31-60" },
  { key: "days61_90", label: "61-90" },
  { key: "days90plus", label: "90+" },
];

export default function FinanceReceivablesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"aging" | "payments">("aging");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/receivables`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Receivables</h1>
          <p className="muted mono">finance.receivable.read</p>
        </div>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="form-grid">
        {BUCKETS.map((b) => (
          <div className="panel" key={b.key}>
            <div className="panel-head">
              <h2>{b.label}</h2>
            </div>
            <p className="mono" style={{ fontSize: 20 }}>{formatMoney(data?.summary?.[b.key] ?? "0")}</p>
          </div>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "aging" ? "tab-active" : ""}`} onClick={() => setTab("aging")}>
          Aging
        </button>
        <button className={`tab ${tab === "payments" ? "tab-active" : ""}`} onClick={() => setTab("payments")}>
          Payment register
        </button>
      </div>

      <div className="panel">
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : tab === "aging" ? (
          (data?.receivables ?? []).length === 0 ? (
            <div className="state-panel state-panel-empty">No receivables.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Due</th>
                  <th>Outstanding</th>
                  <th>Aging</th>
                  <th>Dispute</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.receivables.map((r: any) => (
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
                    <td>{r.disputeStatus}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (data?.recentPayments ?? []).length === 0 ? (
          <div className="state-panel state-panel-empty">No payments.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.map((p: any) => (
                <tr key={p.id}>
                  <td className="mono">{new Date(p.receivedOn).toISOString().slice(0, 10)}</td>
                  <td className="mono">{formatMoney(p.amountCents, p.currency)}</td>
                  <td>{p.method}</td>
                  <td className="mono">{p.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
