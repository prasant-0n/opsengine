"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import { canConvertLead, canTransitionLead, LEAD_SOURCES } from "@/features/crm/lib/crm";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { can } = useShell();
  const [lead, setLead] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [edit, setEdit] = useState({ fullName: "", source: "", nextAction: "", notes: "" });
  const [convert, setConvert] = useState({ target: "account", accountId: "", oppName: "", oppAmount: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/leads/${id}`);
      if (res.status === 403) return setState("denied");
      if (res.status === 404) return setState("notfound");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLead(data.lead);
      setHistory(data.history ?? []);
      setEdit({
        fullName: data.lead.fullName,
        source: data.lead.source,
        nextAction: data.lead.nextAction ?? "",
        notes: data.lead.notes ?? "",
      });
      setState("ok");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/crm/accounts?limit=100")
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => setAccounts([]));
  }, [load]);

  const transition = async (to: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
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

  const doConvert = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = { target: convert.target };
      if (convert.target === "opportunity" || convert.target === "both") {
        body.opportunity = { name: convert.oppName, amountCents: 0 };
        if (convert.oppAmount) {
          const cents = Math.round(parseFloat(convert.oppAmount) * 100);
          if (!Number.isFinite(cents) || cents < 0 || !/^\d+(\.\d{1,2})?$/.test(convert.oppAmount)) {
            throw new Error("Invalid amount (decimal with up to 2 places, non-negative)");
          }
          body.opportunity = { name: convert.oppName, amountCents: cents };
        }
        if (convert.target === "opportunity") body.accountId = convert.accountId;
      }
      if ((convert.target === "opportunity" || convert.target === "both") && !convert.oppName) {
        throw new Error("Opportunity name is required for this target");
      }
      if (convert.target === "opportunity" && !convert.accountId) {
        throw new Error("Existing account is required when target is opportunity only");
      }
      const res = await fetch(`/api/crm/leads/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Convert failed");
      if (data.opportunityId) router.push(`/dashboard/crm/opportunities/${data.opportunityId}`);
      else if (data.accountId) router.push(`/dashboard/crm/accounts/${data.accountId}`);
      else load();
    } catch (e: any) {
      setActionError(e.message ?? "Convert failed");
    } finally {
      setBusy(false);
    }
  };

  if (state === "denied") {
    return (
      <div className="state-panel-denied">
        <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">lock</span>
        <p className="state-panel-title">Permission denied</p>
        <p className="state-panel-note mono">missing: crm.lead.read</p>
      </div>
    );
  }
  if (state === "notfound") {
    return (
      <div className="state-panel-notfound">
        <p className="state-panel-title">Not found</p>
        <p className="state-panel-note">This lead does not exist in your tenant.</p>
      </div>
    );
  }
  if (state === "loading" || !lead) {
    return <div className="state-panel-loading"><p className="state-panel-body animate-pulse">Loading…</p></div>;
  }

  const nextStatuses = lead.status === "converted" ? [] : (["new", "working", "qualified", "unqualified"] as const).filter(
    (s) => s !== lead.status && canConvertLead(lead) && canTransitionLead(lead.status, s),
  );

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="state-panel-note mono"><Link href="/dashboard/crm">crm</Link> / leads</p>
          <h1>{lead.fullName}</h1>
          <p className="state-panel-note">
            <span className={`badge ${lead.status === "converted" || lead.status === "qualified" ? "badge-tertiary" : "badge-primary"}`}>
              {lead.status}
            </span>{" "}
            {lead.company ?? ""} · {lead.source} · owner {lead.ownerName ?? lead.ownerId}
          </p>
        </div>
      </header>

      {actionError ? <p className="state-panel-note mono">{actionError}</p> : null}

      <div className="panel">
        <p className="state-panel-note mono mb-2">lead</p>
        <div className="grid gap-2">
          <input className="input" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />
          <select className="input" value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })}>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="input" placeholder="Next action" value={edit.nextAction} onChange={(e) => setEdit({ ...edit, nextAction: e.target.value })} />
          <textarea className="input" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          {can("crm.lead.update") ? (
            <button
              className="btn btn-primary"
              disabled={busy || lead.status === "converted"}
              onClick={async () => {
                setBusy(true);
                setActionError(null);
                try {
                  const res = await fetch(`/api/crm/leads/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(edit),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.error ?? "Update failed");
                  load();
                } catch (e: any) {
                  setActionError(e.message ?? "Update failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Save fields"}
            </button>
          ) : (
            <p className="state-panel-note mono">missing: crm.lead.update</p>
          )}
        </div>
      </div>

      <div className="panel">
        <p className="state-panel-note mono mb-2">transitions</p>
        {lead.status === "converted" ? (
          <p className="state-panel-note">Converted lead — terminal. Opportunity:{" "}
            {lead.convertedOpportunityId ? <Link href={`/dashboard/crm/opportunities/${lead.convertedOpportunityId}`}>view</Link> : "—"}{" "}
            Account: {lead.convertedAccountId ? <Link href={`/dashboard/crm/accounts/${lead.convertedAccountId}`}>view</Link> : "—"}
          </p>
        ) : nextStatuses.length === 0 ? (
          <p className="state-panel-note">No available transitions.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {nextStatuses.map((s) => (
              <button key={s} className="btn" disabled={busy} onClick={() => transition(s)}>
                move to {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {lead.status !== "converted" && can("crm.lead.convert") ? (
        <div className="panel">
          <p className="state-panel-note mono mb-2">convert lead (governed)</p>
          <div className="grid gap-2">
            <select className="input" value={convert.target} onChange={(e) => setConvert({ ...convert, target: e.target.value })}>
              <option value="account">account only</option>
              <option value="opportunity">opportunity only (existing account)</option>
              <option value="both">account + opportunity</option>
            </select>
            {convert.target === "opportunity" ? (
              <select className="input" value={convert.accountId} onChange={(e) => setConvert({ ...convert, accountId: e.target.value })}>
                <option value="">Existing account *</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : null}
            {convert.target !== "account" ? (
              <>
                <input className="input" placeholder="Opportunity name *" value={convert.oppName} onChange={(e) => setConvert({ ...convert, oppName: e.target.value })} />
                <input className="input" placeholder="Amount (e.g. 25000.00)" value={convert.oppAmount} onChange={(e) => setConvert({ ...convert, oppAmount: e.target.value })} />
              </>
            ) : null}
            <button className="btn btn-primary" disabled={busy} onClick={doConvert}>
              {busy ? "Converting…" : "Convert lead"}
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
