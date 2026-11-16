"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import { formatMoney, PAYMENT_METHODS, ADJUSTMENT_TYPES } from "../lib/finance";
import { PaymentModal } from "./payment-modal";

function statusBadge(status: string): string {
  switch (status) {
    case "paid":
      return "badge badge-tertiary";
    case "partially_paid":
      return "badge badge-primary";
    case "issued":
      return "badge badge-outline";
    case "overdue":
    case "void":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function FinanceInvoiceDetailPage() {
  const { can } = useShell();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [lineForm, setLineForm] = useState({ description: "", quantity: 1, unitPriceCents: 0 });
  const [payForm, setPayForm] = useState({ amountCents: 0, method: "bank_transfer", reference: "" });
  const [adjForm, setAdjForm] = useState({ type: "credit_note", amountCents: 0, reason: "" });
  const [voidReason, setVoidReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");

  const canLine = can("finance.invoice.line.manage");
  const canIssue = can("finance.invoice.issue");
  const canPay = can("finance.receivable.record_payment");
  const canAdjust = can("finance.receivable.adjust");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${id}`, { cache: "no-store" });
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

  async function act(url: string, body?: any, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status})`);
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page-stack">
        <div className="state-panel state-panel-empty">Loading…</div>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="page-stack">
        <div className="state-panel state-panel-error">{error}</div>
      </div>
    );
  }

  const { invoice, lines, receivable, payments, adjustments } = data;
  const isDraft = invoice.status === "draft";

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1 className="mono">{invoice.number}</h1>
          <p className="muted">
            <span className={statusBadge(invoice.status)}>{invoice.status}</span>{" "}
            <span className="mono">total {formatMoney(invoice.totalCents, invoice.currency)}</span>
          </p>
        </div>
        <div className="action-row">
          {isDraft && canIssue && (
            <button className="btn btn-primary" disabled={busy} onClick={() => act(`/api/finance/invoices/${id}/issue`)}>
              Issue
            </button>
          )}
          {invoice.approvalInstanceId && (
            <Link href={`/dashboard/approvals/${invoice.approvalInstanceId}`} className="btn btn-secondary">
              Terms approval
            </Link>
          )}
          {!isDraft && invoice.status !== "void" && invoice.status !== "paid" && (
            <button className="btn btn-primary" onClick={() => setShowPayModal(true)}>
              Pay Online / Link
            </button>
          )}
        </div>
      </header>

      <PaymentModal
        invoiceId={invoice.id}
        invoiceNumber={invoice.number}
        amountCents={Number(receivable?.outstandingCents ?? invoice.totalCents)}
        currency={invoice.currency}
        isOpen={showPayModal}
        onClose={() => {
          setShowPayModal(false);
          load();
        }}
      />

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Line items</h2>
        </div>
        {lines.length === 0 ? (
          <div className="state-panel state-panel-empty">No lines.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Amount</th>
                {isDraft && canLine && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any) => (
                <tr key={l.id}>
                  <td className="mono">{l.lineNumber}</td>
                  <td>{l.description}</td>
                  <td className="mono">{l.quantity}</td>
                  <td className="mono">{formatMoney(l.unitPriceCents, invoice.currency)}</td>
                  <td className="mono">{formatMoney(l.amountCents, invoice.currency)}</td>
                  {isDraft && canLine && (
                    <td>
                      <button className="button link" disabled={busy} onClick={() => act(`/api/finance/invoices/${id}/lines/${l.id}/remove`)}>
                        remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isDraft && canLine && (
          <div className="inline-form">
            <input className="input" placeholder="Description" value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} />
            <input className="input" type="number" min={1} value={lineForm.quantity} onChange={(e) => setLineForm({ ...lineForm, quantity: Number(e.target.value) })} />
            <input className="input" type="number" min={0} placeholder="Unit price (cents)" value={lineForm.unitPriceCents} onChange={(e) => setLineForm({ ...lineForm, unitPriceCents: Number(e.target.value) })} />
            <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/api/finance/invoices/${id}/lines`, lineForm)}>
              Add line
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Totals</h2>
        </div>
        <ul className="detail-list">
          <li>
            <span>Subtotal</span>
            <span className="mono">{formatMoney(invoice.subtotalCents, invoice.currency)}</span>
          </li>
          <li>
            <span>Tax</span>
            <span className="mono">{formatMoney(invoice.taxCents, invoice.currency)}</span>
          </li>
          <li>
            <span>Total</span>
            <span className="mono">{formatMoney(invoice.totalCents, invoice.currency)}</span>
          </li>
        </ul>
      </div>

      {receivable && (
        <div className="panel">
          <div className="panel-head">
            <h2>Receivable</h2>
          </div>
          <ul className="detail-list">
            <li>
              <span>Original</span>
              <span className="mono">{formatMoney(receivable.originalAmountCents, invoice.currency)}</span>
            </li>
            <li>
              <span>Paid</span>
              <span className="mono">{formatMoney(receivable.paidAmountCents, invoice.currency)}</span>
            </li>
            <li>
              <span>Outstanding</span>
              <span className="mono">{formatMoney(receivable.outstandingCents, invoice.currency)}</span>
            </li>
            <li>
              <span>Status</span>
              <span>{receivable.status}</span>
            </li>
          </ul>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>Payments</h2>
        </div>
        {payments.length === 0 ? (
          <div className="state-panel state-panel-empty">No payments recorded.</div>
        ) : (
          <ul className="history-list">
            {payments.map((p: any) => (
              <li key={p.id}>
                <span className="mono">{new Date(p.receivedOn).toISOString().slice(0, 10)}</span> ·{" "}
                <strong className="mono">{formatMoney(p.amountCents, p.currency)}</strong> · {p.method}
                {p.reference ? <span className="muted"> · {p.reference}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {canPay && !isDraft && invoice.status !== "void" && (
          <div className="inline-form">
            <input className="input" type="number" min={0} placeholder="Amount (cents)" value={payForm.amountCents} onChange={(e) => setPayForm({ ...payForm, amountCents: Number(e.target.value) })} />
            <select className="input" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Reference" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
            <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/api/finance/invoices/${id}/payments`, payForm)}>
              Record payment
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Adjustments (append-only)</h2>
        </div>
        {adjustments.length === 0 ? (
          <div className="state-panel state-panel-empty">No adjustments.</div>
        ) : (
          <ul className="history-list">
            {adjustments.map((a: any) => (
              <li key={a.id}>
                <span className="badge badge-outline">{a.type}</span>{" "}
                <span className="mono">{formatMoney(a.amountCents, invoice.currency)}</span> · {a.reason}
              </li>
            ))}
          </ul>
        )}
        {canAdjust && !isDraft && (
          <div className="inline-form">
            <select className="input" value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })}>
              {ADJUSTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input className="input" type="number" placeholder="Amount (cents, signed)" value={adjForm.amountCents} onChange={(e) => setAdjForm({ ...adjForm, amountCents: Number(e.target.value) })} />
            <input className="input" placeholder="Reason" value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} />
            <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/api/finance/invoices/${id}/adjustments`, adjForm)}>
              Record adjustment
            </button>
          </div>
        )}
      </div>

      {canIssue && (
        <div className="panel">
          <div className="panel-head">
            <h2>Dispute &amp; void</h2>
          </div>
          <p className="muted">Dispute status: {invoice.disputeStatus}</p>
          {!isDraft && invoice.status !== "void" && (
            <div className="inline-form">
              <input className="input" placeholder="Dispute reason" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
              <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/api/finance/invoices/${id}/dispute`, { action: "raise", reason: disputeReason })}>
                Raise dispute
              </button>
              {invoice.disputeStatus === "raised" && (
                <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/api/finance/invoices/${id}/dispute`, { action: "resolve" })}>
                  Resolve dispute
                </button>
              )}
            </div>
          )}
          {invoice.status !== "paid" && invoice.status !== "void" && (
            <div className="inline-form">
              <input className="input" placeholder="Void reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
              <button className="btn btn-danger" disabled={busy} onClick={() => act(`/api/finance/invoices/${id}/void`, { reason: voidReason })}>
                Void invoice
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
