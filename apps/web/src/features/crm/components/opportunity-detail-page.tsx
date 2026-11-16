"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import {
  canTransitionOpportunity,
  isGovernedOpportunityStage,
  OPPORTUNITY_STAGES,
  parseAmountToCents,
} from "@/features/crm/lib/crm";

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { can } = useShell();
  const [opp, setOpp] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", amount: "", probability: "" });
  const [outcome, setOutcome] = useState({ action: "won", reason: "", competitorNotes: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/opportunities/${id}`);
      if (res.status === 403) return setState("denied");
      if (res.status === 404) return setState("notfound");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOpp(data.opportunity);
      setHistory(data.history ?? []);
      setEdit({
        name: data.opportunity.name,
        amount: (Number(data.opportunity.amountCents) / 100).toFixed(2),
        probability: data.opportunity.probability?.toString() ?? "",
      });
      setState("ok");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isClosed = opp?.stage === "won" || opp?.stage === "lost";

  const transition = async (to: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Transition failed");
      load();
    } catch (e: any) {
      setActionError(e.message ?? "Transition failed");
    } finally {
      setBusy(false);
    }
  };

  const saveFields = async () => {
    const amountCents = parseAmountToCents(edit.amount || "0");
    if (amountCents === null || amountCents < 0) {
      setActionError("Amount must be a non-negative decimal (up to 2 decimals).");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name,
          amountCents,
          probability: edit.probability === "" ? null : Number(edit.probability),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      load();
    } catch (e: any) {
      setActionError(e.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const recordOutcome = async () => {
    setBusy(true);
    setActionError(null);
    try {
      if (outcome.action === "lost" && !outcome.reason) throw new Error("Lost outcome requires a reason");
      const res = await fetch(`/api/crm/opportunities/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outcome),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Outcome failed");
      load();
    } catch (e: any) {
      setActionError(e.message ?? "Outcome failed");
    } finally {
      setBusy(false);
    }
  };

  if (state === "denied") {
    return (
      <div className="state-panel-denied">
        <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">lock</span>
        <p className="state-panel-title">Permission denied</p>
        <p className="state-panel-note mono">missing: crm.opportunity.read</p>
      </div>
    );
  }
  if (state === "notfound") {
    return (
      <div className="state-panel-notfound">
        <p className="state-panel-title">Not found</p>
        <p className="state-panel-note">This opportunity does not exist in your tenant.</p>
      </div>
    );
  }
  if (state === "loading" || !opp) {
    return <div className="state-panel-loading"><p className="state-panel-body animate-pulse">Loading…</p></div>;
  }

  const moves = OPPORTUNITY_STAGES.filter(
    (s) => !isGovernedOpportunityStage(s) && s !== opp.stage && canTransitionOpportunity(opp.stage, s),
  );

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="state-panel-note mono"><Link href="/dashboard/crm">crm</Link> / opportunities</p>
          <h1>{opp.name}</h1>
          <p className="state-panel-note">
            <span className={`badge ${opp.stage === "won" ? "badge-tertiary" : opp.stage === "lost" ? "badge-outline" : "badge-primary"}`}>
              {opp.stage}
            </span>{" "}
            {opp.accountName ? <Link href={`/dashboard/crm/accounts/${opp.accountId}`}>{opp.accountName}</Link> : null}{" "}
            · <span className="mono">{opp.amountFormatted}</span> · owner {opp.ownerName ?? opp.ownerId}
          </p>
        </div>
      </header>

      {actionError ? <p className="state-panel-note mono">{actionError}</p> : null}

      <div className="panel">
        <p className="state-panel-note mono mb-2">opportunity</p>
        <div className="grid gap-2">
          <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} disabled={isClosed} />
          <input className="input" placeholder="Amount (e.g. 45000.00)" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} disabled={isClosed} />
          <input className="input" placeholder="Probability 0-100" value={edit.probability} onChange={(e) => setEdit({ ...edit, probability: e.target.value })} disabled={isClosed} />
          {can("crm.opportunity.update") && !isClosed ? (
            <button className="btn btn-primary" disabled={busy} onClick={saveFields}>{busy ? "Saving…" : "Save fields"}</button>
          ) : isClosed ? (
            <p className="state-panel-note">Closed {opp.stage} — fields locked.</p>
          ) : (
            <p className="state-panel-note mono">missing: crm.opportunity.update</p>
          )}
        </div>
      </div>

      <div className="panel">
        <p className="state-panel-note mono mb-2">stage moves (won/lost are governed)</p>
        {isClosed ? (
          <p className="state-panel-note">Terminal stage — see outcome below.</p>
        ) : moves.length === 0 ? (
          <p className="state-panel-note">No available moves.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {moves.map((s) => (
              <button key={s} className="btn" disabled={busy || !can("crm.opportunity.update")} onClick={() => transition(s)}>
                move to {s}
              </button>
            ))}
            {!can("crm.opportunity.update") ? <p className="state-panel-note mono">missing: crm.opportunity.update</p> : null}
          </div>
        )}
      </div>

      {!isClosed && can("crm.opportunity.approve_stage") ? (
        <div className="panel">
          <p className="state-panel-note mono mb-2">record outcome (governed · audited)</p>
          <div className="grid gap-2">
            <select className="input" value={outcome.action} onChange={(e) => setOutcome({ ...outcome, action: e.target.value })}>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </select>
            {outcome.action === "lost" ? (
              <>
                <input className="input" placeholder="Lost reason * (required)" value={outcome.reason} onChange={(e) => setOutcome({ ...outcome, reason: e.target.value })} />
                <input className="input" placeholder="Competitor notes" value={outcome.competitorNotes} onChange={(e) => setOutcome({ ...outcome, competitorNotes: e.target.value })} />
              </>
            ) : (
              <input className="input" placeholder="Note (optional)" value={outcome.reason} onChange={(e) => setOutcome({ ...outcome, reason: e.target.value })} />
            )}
            <button className="btn btn-primary" disabled={busy} onClick={recordOutcome}>
              {busy ? "Recording…" : `Record ${outcome.action}`}
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <p className="state-panel-note mono">stage history</p>
        {history.length === 0 ? (
          <p className="state-panel-note mt-2">No history yet.</p>
        ) : (
          <ul className="mt-2">
            {history.map((h) => (
              <li key={h.id} className="py-1">
                <span className="mono">{h.fromStatus ?? "∅"} → {h.toStatus}</span>{" "}
                <span className="state-panel-note">· {h.reason ?? "—"} · {new Date(h.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
