"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";
import { ACCOUNT_STATUSES, CLIENT_TIERS } from "@/features/crm/lib/crm";

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { can } = useShell();
  const [account, setAccount] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [employees, setEmployees] = useState<{ id: string; displayName: string }[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [edit, setEdit] = useState({ status: "", clientTier: "", ownerId: "", notes: "" });
  const [contactForm, setContactForm] = useState({ fullName: "", email: "", title: "" });
  const [showContactForm, setShowContactForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/accounts/${id}`);
      if (res.status === 403) return setState("denied");
      if (res.status === 404) return setState("notfound");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAccount(data.account);
      setContacts(data.contacts ?? []);
      setOpportunities(data.opportunities ?? []);
      setEdit({
        status: data.account.status,
        clientTier: data.account.clientTier ?? "",
        ownerId: data.account.ownerId,
        notes: data.account.notes ?? "",
      });
      setState("ok");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/org/employees?limit=100")
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => setEmployees((d.employees ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName }))))
      .catch(() => setEmployees([]));
  }, [load]);

  const save = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/crm/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: edit.status,
          clientTier: edit.clientTier || null,
          ownerId: edit.ownerId,
          notes: edit.notes,
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

  const addContact = async () => {
    if (!contactForm.fullName || !contactForm.email) {
      setActionError("Contact name and email are required.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contactForm, accountId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setContactForm({ fullName: "", email: "", title: "" });
      setShowContactForm(false);
      load();
    } catch (e: any) {
      setActionError(e.message ?? "Create failed");
    } finally {
      setBusy(false);
    }
  };

  if (state === "denied") {
    return (
      <div className="state-panel-denied">
        <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">lock</span>
        <p className="state-panel-title">Permission denied</p>
        <p className="state-panel-note mono">missing: crm.account.read</p>
      </div>
    );
  }
  if (state === "notfound") {
    return (
      <div className="state-panel-notfound">
        <p className="state-panel-title">Not found</p>
        <p className="state-panel-note">This account does not exist in your tenant.</p>
      </div>
    );
  }
  if (state === "loading" || !account) {
    return <div className="state-panel-loading"><p className="state-panel-body animate-pulse">Loading…</p></div>;
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="state-panel-note mono"><Link href="/dashboard/crm">crm</Link> / accounts</p>
          <h1>{account.name}</h1>
          <p className="state-panel-note">
            <span className={`badge ${account.status === "active" ? "badge-tertiary" : "badge-primary"}`}>{account.status}</span>{" "}
            {account.clientTier ? <span className="badge badge-outline">{account.clientTier}</span> : null}{" "}
            {account.industry ?? ""} · owner {account.ownerName ?? account.ownerId}
          </p>
        </div>
      </header>

      <div className="panel">
        <p className="state-panel-note mono mb-2">account</p>
        <div className="grid gap-2">
          <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
            {ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" value={edit.clientTier} onChange={(e) => setEdit({ ...edit, clientTier: e.target.value })}>
            <option value="">Tier (none)</option>
            {CLIENT_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input" value={edit.ownerId} onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })}>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.displayName}</option>)}
          </select>
          <textarea className="input" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          {actionError ? <p className="state-panel-note mono">{actionError}</p> : null}
          {can("crm.account.update") ? (
            <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
          ) : (
            <p className="state-panel-note mono">missing: crm.account.update</p>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="flex items-center justify-between">
          <p className="state-panel-note mono">contacts ({contacts.length})</p>
          {can("crm.contact.create") ? (
            <button className="btn" onClick={() => setShowContactForm((v) => !v)}>
              {showContactForm ? "Cancel" : "Add contact"}
            </button>
          ) : null}
        </div>
        {showContactForm ? (
          <div className="grid gap-2 mt-2">
            <input className="input" placeholder="Full name *" value={contactForm.fullName} onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })} />
            <input className="input" placeholder="Email *" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
            <input className="input" placeholder="Title" value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} />
            <button className="btn btn-primary" disabled={busy} onClick={addContact}>Add contact</button>
          </div>
        ) : null}
        {contacts.length === 0 ? (
          <p className="state-panel-note mt-2">No contacts yet.</p>
        ) : (
          <ul className="mt-2">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-1">
                <span>{c.fullName}</span>
                {c.isPrimary ? <span className="badge badge-primary">primary</span> : null}
                <span className="state-panel-note mono">{c.email}</span>
                {c.title ? <span className="state-panel-note">· {c.title}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <p className="state-panel-note mono">opportunities ({opportunities.length})</p>
        {opportunities.length === 0 ? (
          <p className="state-panel-note mt-2">No opportunities yet.</p>
        ) : (
          <ul className="mt-2">
            {opportunities.map((o) => (
              <li key={o.id} className="flex items-center gap-2 py-1">
                <Link href={`/dashboard/crm/opportunities/${o.id}`}>{o.name}</Link>
                <span className={`badge ${o.stage === "won" ? "badge-tertiary" : "badge-outline"}`}>{o.stage}</span>
                <span className="mono">{o.amountFormatted}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
