"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import {
  ACCOUNT_STATUSES,
  LEAD_SOURCES,
  OPPORTUNITY_STAGES,
  formatCents,
  parseAmountToCents,
} from "@/features/crm/lib/crm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

type Tab = "accounts" | "leads" | "opportunities";

function accountBadge(status: string): string {
  switch (status) {
    case "active":
      return "badge badge-tertiary";
    case "prospect":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

function leadBadge(status: string): string {
  switch (status) {
    case "qualified":
    case "converted":
      return "badge badge-tertiary";
    case "working":
    case "new":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

function stageBadge(stage: string): string {
  switch (stage) {
    case "won":
      return "badge badge-tertiary";
    case "lost":
      return "badge badge-outline";
    case "negotiation":
    case "proposal":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

interface EmployeeOption {
  id: string;
  displayName: string;
}

function useEmployees(): EmployeeOption[] {
  const [emps, setEmps] = useState<EmployeeOption[]>([]);
  useEffect(() => {
    fetch("/api/org/employees?limit=100")
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => setEmps((d.employees ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName }))))
      .catch(() => setEmps([]));
  }, []);
  return emps;
}

function AccountsTab() {
  const { can } = useShell();
  const employees = useEmployees();
  const [rows, setRows] = useState<any[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", source: "inbound", clientTier: "", ownerId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/crm/accounts?${params.toString()}`);
      if (res.status === 403) return setState("denied");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.accounts ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.name || !form.ownerId) {
      setFormError("Name and owner are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/crm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          industry: form.industry || null,
          source: form.source,
          clientTier: form.clientTier || null,
          ownerId: form.ownerId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setForm({ name: "", industry: "", source: "inbound", clientTier: "", ownerId: "" });
      setShowForm(false);
      load();
    } catch (e: any) {
      setFormError(e.message ?? "Create failed");
    } finally {
      setSaving(false);
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

  return (
    <div className="page-stack">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="state-panel-note mono">status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {can("crm.account.create") ? (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1 inline" />
            New account
          </button>
        ) : null}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Client Account</DialogTitle>
            <DialogDescription>
              Create a client account record with owner assignment and relationship tier.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <input className="input" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="input" value={form.clientTier} onChange={(e) => setForm({ ...form, clientTier: e.target.value })}>
              <option value="">Tier (default)</option>
              <option value="standard">standard</option>
              <option value="strategic">strategic</option>
            </select>
            <select className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
              <option value="">Owner *</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.displayName}</option>
              ))}
            </select>
            {formError ? <p className="state-panel-note mono">{formError}</p> : null}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={create}>
              {saving ? "Saving…" : "Create account"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {state === "loading" ? (
        <div className="state-panel-loading"><p className="state-panel-body animate-pulse">Loading…</p></div>
      ) : state === "error" ? (
        <div className="state-panel-error"><p className="state-panel-title">Failed to load accounts.</p></div>
      ) : rows.length === 0 ? (
        <div className="state-panel-empty">
          <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">handshake</span>
          <p className="state-panel-title">No accounts yet</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Industry</th><th>Status</th><th>Tier</th><th>Owner</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/dashboard/crm/accounts/${r.id}`}>{r.name}</Link></td>
                <td>{r.industry ?? "—"}</td>
                <td><span className={accountBadge(r.status)}>{r.status}</span></td>
                <td>{r.clientTier ?? "—"}</td>
                <td>{r.ownerName ?? r.ownerId}</td>
                <td className="mono">{new Date(r.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LeadsTab() {
  const { can } = useShell();
  const employees = useEmployees();
  const [rows, setRows] = useState<any[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", company: "", source: "inbound", ownerId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/crm/leads?${params.toString()}`);
      if (res.status === 403) return setState("denied");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.leads ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.fullName || !form.ownerId) {
      setFormError("Name and owner are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setForm({ fullName: "", email: "", company: "", source: "inbound", ownerId: "" });
      setShowForm(false);
      load();
    } catch (e: any) {
      setFormError(e.message ?? "Create failed");
    } finally {
      setSaving(false);
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

  return (
    <div className="page-stack">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="state-panel-note mono">status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {["new", "working", "qualified", "unqualified", "converted"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {can("crm.lead.create") ? (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1 inline" />
            New lead
          </button>
        ) : null}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sales Lead</DialogTitle>
            <DialogDescription>
              Capture inbound lead contact information and qualify them for pipeline conversion.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <input className="input" placeholder="Full name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
              <option value="">Owner *</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.displayName}</option>
              ))}
            </select>
            {formError ? <p className="state-panel-note mono">{formError}</p> : null}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={create}>
              {saving ? "Saving…" : "Create lead"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {state === "loading" ? (
        <div className="state-panel-loading"><p className="state-panel-body animate-pulse">Loading…</p></div>
      ) : state === "error" ? (
        <div className="state-panel-error"><p className="state-panel-title">Failed to load leads.</p></div>
      ) : rows.length === 0 ? (
        <div className="state-panel-empty">
          <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">person_search</span>
          <p className="state-panel-title">No leads yet</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Company</th><th>Source</th><th>Status</th><th>Next action</th><th>Owner</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/dashboard/crm/leads/${r.id}`}>{r.fullName}</Link></td>
                <td>{r.company ?? "—"}</td>
                <td>{r.source}</td>
                <td><span className={leadBadge(r.status)}>{r.status}</span></td>
                <td>{r.nextAction ?? "—"}</td>
                <td>{r.ownerName ?? r.ownerId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function OpportunitiesTab() {
  const { can } = useShell();
  const employees = useEmployees();
  const [rows, setRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [stage, setStage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ accountId: "", name: "", amount: "", ownerId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm/accounts?limit=100")
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => setAccounts([]));
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (stage) params.set("stage", stage);
      const res = await fetch(`/api/crm/opportunities?${params.toString()}`);
      if (res.status === 403) return setState("denied");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.opportunities ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [stage]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.accountId || !form.name || !form.ownerId) {
      setFormError("Account, name and owner are required.");
      return;
    }
    const amountCents = parseAmountToCents(form.amount || "0");
    if (amountCents === null || amountCents < 0) {
      setFormError("Amount must be a non-negative decimal (up to 2 decimals).");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: form.accountId, name: form.name, amountCents, ownerId: form.ownerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setForm({ accountId: "", name: "", amount: "", ownerId: "" });
      setShowForm(false);
      load();
    } catch (e: any) {
      setFormError(e.message ?? "Create failed");
    } finally {
      setSaving(false);
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

  return (
    <div className="page-stack">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="state-panel-note mono">stage</label>
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All</option>
            {OPPORTUNITY_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {can("crm.opportunity.create") ? (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1 inline" />
            New opportunity
          </button>
        ) : null}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sales Opportunity</DialogTitle>
            <DialogDescription>
              Create a sales deal linked to an account with estimated value and pipeline stage.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <select className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">Account *</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <input className="input" placeholder="Opportunity name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Amount (e.g. 45000.00)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
              <option value="">Owner *</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.displayName}</option>
              ))}
            </select>
            {formError ? <p className="state-panel-note mono">{formError}</p> : null}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={create}>
              {saving ? "Saving…" : "Create opportunity"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {state === "loading" ? (
        <div className="state-panel-loading"><p className="state-panel-body animate-pulse">Loading…</p></div>
      ) : state === "error" ? (
        <div className="state-panel-error"><p className="state-panel-title">Failed to load opportunities.</p></div>
      ) : rows.length === 0 ? (
        <div className="state-panel-empty">
          <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">currency_exchange</span>
          <p className="state-panel-title">No opportunities yet</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Account</th><th>Stage</th><th>Amount</th><th>Close date</th><th>Owner</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/dashboard/crm/opportunities/${r.id}`}>{r.name}</Link></td>
                <td>{r.accountName ?? r.accountId}</td>
                <td><span className={stageBadge(r.stage)}>{r.stage}</span></td>
                <td className="mono">{r.amountFormatted ?? formatCents(r.amountCents, r.currency)}</td>
                <td>{r.expectedCloseDate ? new Date(r.expectedCloseDate).toLocaleDateString() : "—"}</td>
                <td>{r.ownerName ?? r.ownerId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CrmPage() {
  const { can } = useShell();
  const [tab, setTab] = useState<Tab>("accounts");
  const allowed =
    can("crm.account.read") || can("crm.lead.read") || can("crm.opportunity.read");

  if (!allowed) {
    return (
      <div className="page-stack">
        <div className="state-panel-denied">
          <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">lock</span>
          <p className="state-panel-title">Permission denied</p>
          <p className="state-panel-note mono">missing: crm.account.read · crm.lead.read · crm.opportunity.read</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>CRM &amp; Sales</h1>
          <p className="state-panel-note">Accounts, leads and opportunities · tenant-scoped pipeline</p>
        </div>
      </header>

      <nav className="tabs" aria-label="CRM sections">
        <button className={`tab ${tab === "accounts" ? "tab-active" : ""}`} onClick={() => setTab("accounts")}>
          Accounts
        </button>
        <button className={`tab ${tab === "leads" ? "tab-active" : ""}`} onClick={() => setTab("leads")}>
          Leads
        </button>
        <button className={`tab ${tab === "opportunities" ? "tab-active" : ""}`} onClick={() => setTab("opportunities")}>
          Opportunities
        </button>
      </nav>

      {tab === "accounts" ? <AccountsTab /> : null}
      {tab === "leads" ? <LeadsTab /> : null}
      {tab === "opportunities" ? <OpportunitiesTab /> : null}
    </div>
  );
}
