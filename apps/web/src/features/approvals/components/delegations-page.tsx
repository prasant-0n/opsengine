"use client";

import { useCallback, useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";
import { DELEGATION_SCOPE_TYPES, SUBJECT_TYPES } from "@/features/approvals/lib/approvals";

export default function DelegationsPage() {
  const { whoami } = useShell();
  const [delegations, setDelegations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [employees, setEmployees] = useState<Array<{ id: string; displayName: string }>>([]);
  const [form, setForm] = useState({ toEmployeeId: "", scopeType: "ALL", scopeValue: "", startDate: "", endDate: "", reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/approvals/delegations", { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      const d = await res.json();
      setDelegations(d.delegations ?? []);
      const empRes = await fetch("/api/org/employees", { cache: "no-store" }).catch(() => null);
      if (empRes && empRes.ok) {
        const ed = await empRes.json().catch(() => ({}));
        setEmployees((ed.employees ?? ed.items ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName ?? e.name ?? e.id })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setMsg(null);
    if (!form.toEmployeeId || !form.startDate || !form.endDate) {
      setMsg({ type: "error", text: "Delegate, start date and end date are required." });
      return;
    }
    const res = await fetch("/api/approvals/delegations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toEmployeeId: form.toEmployeeId,
        scopeType: form.scopeType,
        scopeValue: form.scopeType === "ALL" ? undefined : form.scopeValue,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: d.error ?? `Failed (${res.status})` });
      return;
    }
    setMsg({ type: "ok", text: "Delegation created." });
    setForm({ toEmployeeId: "", scopeType: "ALL", scopeValue: "", startDate: "", endDate: "", reason: "" });
    load();
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Approval Delegations</h1>
          <p className="muted mono">approval.delegate · time-bounded substitution</p>
        </div>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}
      {msg && <div className={`state-panel state-panel-${msg.type === "ok" ? "ok" : "error"}`}>{msg.text}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>New delegation</h2>
          <span className="muted mono">from {String(whoami?.employeeId ?? "").slice(0, 8)}</span>
        </div>
        <div className="form-grid">
          <select className="input" value={form.toEmployeeId} onChange={(e) => setForm({ ...form, toEmployeeId: e.target.value })}>
            <option value="">Delegate to…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
          </select>
          <select className="input" value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value })}>
            {DELEGATION_SCOPE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {form.scopeType === "SUBJECT_TYPE" && (
            <select className="input" value={form.scopeValue} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}>
              <option value="">Subject type…</option>
              {SUBJECT_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {form.scopeType === "SPECIFIC_DEFINITION" && (
            <input className="input mono" placeholder="Workflow version id" value={form.scopeValue} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })} />
          )}
          <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <input className="input" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button className="btn btn-primary" onClick={create}>
            Create delegation
          </button>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : delegations.length === 0 ? (
          <div className="state-panel state-panel-empty">No delegations.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Scope</th>
                <th>Window</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {delegations.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.fromName ?? String(d.fromEmployeeId).slice(0, 8)}</td>
                  <td className="mono">{d.toName ?? String(d.toEmployeeId).slice(0, 8)}</td>
                  <td className="mono">
                    {d.scopeType}
                    {d.scopeValue ? ` · ${String(d.scopeValue).slice(0, 8)}` : ""}
                  </td>
                  <td className="mono">
                    {new Date(d.startDate).toISOString().slice(0, 10)} → {new Date(d.endDate).toISOString().slice(0, 10)}
                  </td>
                  <td>{d.inWindow ? <span className="badge badge-tertiary">active</span> : <span className="badge badge-outline">inactive</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
