"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import { formatMoney } from "@/features/finance/lib/finance";

function statusBadge(status: string): string {
  switch (status) {
    case "accepted":
      return "badge badge-tertiary";
    case "sent":
    case "approved":
      return "badge badge-primary";
    case "pending_approval":
      return "badge badge-outline";
    case "declined":
    case "withdrawn":
    case "expired":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function OfferDetailPage() {
  const { can } = useShell();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const canCreate = can("recruit.offer.create");
  const canSend = can("recruit.offer.send");
  const canDecide = can("recruit.offer.decide");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recruit/offers/${id}`, { cache: "no-store" });
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

  async function act(url: string, body?: any) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
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

  if (loading) return <div className="page-stack"><div className="state-panel state-panel-empty">Loading…</div></div>;
  if (!data) return <div className="page-stack"><div className="state-panel state-panel-error">{error ?? "Not found"}</div></div>;

  const offer = data.offer;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1 className="mono">{offer.number}</h1>
          <p className="muted">
            {data.candidate?.fullName ?? "—"} · {offer.jobTitle} · <span className={statusBadge(offer.status)}>{offer.status}</span>
          </p>
        </div>
        <p className="mono">{formatMoney(offer.baseCompCents, offer.currency)}</p>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Offer terms</h2>
        </div>
        <dl className="detail-list">
          <dt>Candidate</dt>
          <dd>{data.candidate?.fullName ?? "—"}</dd>
          <dt>Job title</dt>
          <dd>{offer.jobTitle}</dd>
          <dt>Employment type</dt>
          <dd>{offer.employmentType ?? "—"}</dd>
          <dt>Location</dt>
          <dd>{offer.location ?? "—"}</dd>
          <dt>Work mode</dt>
          <dd>{offer.workMode ?? "—"}</dd>
          <dt>Start date</dt>
          <dd className="mono">{offer.startDate ? new Date(offer.startDate).toISOString().slice(0, 10) : "—"}</dd>
          <dt>Base compensation</dt>
          <dd className="mono">{formatMoney(offer.baseCompCents, offer.currency)}</dd>
          <dt>Variable</dt>
          <dd className="mono">{offer.variableCents !== null ? formatMoney(offer.variableCents, offer.currency) : "—"}</dd>
          <dt>Template</dt>
          <dd>{data.template ? `${data.template.name} (v${data.template.version})` : "—"}</dd>
          <dt>Notes</dt>
          <dd>{offer.notes ?? "—"}</dd>
        </dl>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Approval</h2>
        </div>
        {offer.approvalInstanceId ? (
          <p>
            <Link href={`/dashboard/approvals/${offer.approvalInstanceId}`} className="link">
              View approval instance
            </Link>
          </p>
        ) : (
          <p className="muted">No approval requested yet.</p>
        )}
        {offer.status === "draft" && canCreate && (
          <div className="action-row">
            <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/api/recruit/offers/${id}/request-approval`, {})}>
              Request approval
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Actions</h2>
        </div>
        {offer.status === "approved" && canSend && (
          <div className="action-row">
            <button className="btn btn-primary" disabled={busy} onClick={() => act(`/api/recruit/offers/${id}/send`)}>
              Send offer
            </button>
          </div>
        )}
        {offer.status === "pending_approval" && <p className="muted">Awaiting approval before send.</p>}
        {offer.status === "sent" && canDecide && (
          <div className="action-row">
            <button className="btn btn-primary" disabled={busy} onClick={() => act(`/api/recruit/offers/${id}/respond`, { action: "accept" })}>
              Record acceptance
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => act(`/api/recruit/offers/${id}/respond`, { action: "decline", reason: declineReason })}>
              Record decline
            </button>
            <input className="input" placeholder="Decline reason" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
          </div>
        )}
        {offer.status === "accepted" && data.plan && (
          <p>
            Onboarding plan created:{" "}
            <Link href={`/dashboard/onboarding/plans/${data.plan.id}`} className="link">
              view plan
            </Link>
          </p>
        )}
        {(offer.status === "draft" || offer.status === "pending_approval" || offer.status === "approved") && canDecide && (
          <div className="action-row">
            <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/api/recruit/offers/${id}/respond`, { action: "withdraw" })}>
              Withdraw
            </button>
          </div>
        )}
        {offer.sentAt && (
          <p className="muted mono">
            Sent {new Date(offer.sentAt).toISOString().slice(0, 10)}
            {offer.respondedAt ? ` · responded ${new Date(offer.respondedAt).toISOString().slice(0, 10)}` : ""}
          </p>
        )}
        {offer.declineReason && <p className="muted">Decline reason: {offer.declineReason}</p>}
      </div>
    </div>
  );
}
