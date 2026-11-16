"use client";

import { useCallback, useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";
import { SUBJECT_TYPES } from "@/features/approvals/lib/approvals";

const DEFAULT_RULES = JSON.stringify(
  {
    steps: [
      { stepNumber: 1, name: "Manager review", mode: "any", resolver: { type: "REPORTING_MANAGER_OF_REQUESTER" }, minApprovals: 1 },
    ],
  },
  null,
  2,
);

export default function WorkflowsPage() {
  const { can } = useShell();
  const canManage = can("approval.workflow.manage");
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState({ name: "", subjectType: "allocation", description: "", rules: DEFAULT_RULES });
  const [versionRules, setVersionRules] = useState(DEFAULT_RULES);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/approvals/workflows", { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      const d = await res.json();
      setWorkflows(d.workflows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setSelected(id);
    setDetail(null);
    const res = await fetch(`/api/approvals/workflows/${id}`, { cache: "no-store" });
    if (res.ok) setDetail(await res.json());
  }, []);

  async function createWorkflow() {
    setMsg(null);
    let rules: unknown;
    try {
      rules = JSON.parse(form.rules);
    } catch {
      setMsg({ type: "error", text: "Rules must be valid JSON." });
      return;
    }
    const res = await fetch("/api/approvals/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.name, subjectType: form.subjectType, description: form.description, rules }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: d.details ? d.details.join("; ") : d.error ?? `Failed (${res.status})` });
      return;
    }
    setMsg({ type: "ok", text: "Workflow created (draft v1)." });
    setForm({ name: "", subjectType: "allocation", description: "", rules: DEFAULT_RULES });
    load();
  }

  async function addVersion() {
    if (!selected) return;
    setMsg(null);
    let rules: unknown;
    try {
      rules = JSON.parse(versionRules);
    } catch {
      setMsg({ type: "error", text: "Rules must be valid JSON." });
      return;
    }
    const res = await fetch(`/api/approvals/workflows/${selected}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: d.details ? d.details.join("; ") : d.error ?? `Failed (${res.status})` });
      return;
    }
    setMsg({ type: "ok", text: `Draft v${d.version.versionNumber} added.` });
    openDetail(selected);
  }

  async function publish(versionNumber: number) {
    if (!selected) return;
    setMsg(null);
    const res = await fetch(`/api/approvals/workflows/${selected}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versionNumber }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: d.error ?? `Failed (${res.status})` });
      return;
    }
    setMsg({ type: "ok", text: `Published v${versionNumber}.` });
    openDetail(selected);
    load();
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Approval Workflows</h1>
          <p className="muted mono">approval.workflow.read · validated rule data</p>
        </div>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}
      {msg && <div className={`state-panel state-panel-${msg.type === "ok" ? "ok" : "error"}`}>{msg.text}</div>}

      {canManage && (
        <div className="panel">
          <div className="panel-head">
            <h2>New workflow</h2>
          </div>
          <div className="form-grid">
            <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.subjectType} onChange={(e) => setForm({ ...form, subjectType: e.target.value })}>
              {SUBJECT_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <textarea className="input mono" rows={6} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />
            <button className="btn btn-primary" onClick={createWorkflow}>
              Create workflow
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : workflows.length === 0 ? (
          <div className="state-panel state-panel-empty">No workflows defined.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject type</th>
                <th>Latest version</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <button className="link mono" onClick={() => openDetail(w.id)}>
                      {w.name}
                    </button>
                  </td>
                  <td className="mono">{w.subjectType}</td>
                  <td>
                    {w.latestVersion ? (
                      <>
                        v{w.latestVersion.versionNumber} <span className="badge badge-outline">{w.latestVersion.status}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{w.active ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && detail && (
        <div className="panel">
          <div className="panel-head">
            <h2>{detail.workflow.name}</h2>
            <span className="muted mono">{detail.workflow.subjectType}</span>
          </div>
          <ul className="history-list">
            {detail.versions.map((v: any) => (
              <li key={v.id}>
                <strong>v{v.versionNumber}</strong> <span className="badge badge-outline">{v.status}</span>
                <ul className="detail-list">
                  {v.summary.map((line: string, idx: number) => (
                    <li key={idx} className="mono muted">
                      {line}
                    </li>
                  ))}
                </ul>
                {canManage && v.status === "draft" && (
                  <button className="btn btn-primary" onClick={() => publish(v.versionNumber)}>
                    Publish v{v.versionNumber}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <div className="form-grid">
              <label className="muted">Add version (rules JSON)</label>
              <textarea className="input mono" rows={6} value={versionRules} onChange={(e) => setVersionRules(e.target.value)} />
              <button className="btn btn-secondary" onClick={addVersion}>
                Add version
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
