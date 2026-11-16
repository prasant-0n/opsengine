"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";

function statusBadge(status: string): string {
  switch (status) {
    case "approved":
      return "badge badge-tertiary";
    case "rejected":
      return "badge badge-error";
    case "cancelled":
      return "badge badge-outline";
    case "skipped":
      return "badge badge-outline";
    case "pending":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

function decisionBadge(d: string): string {
  switch (d) {
    case "approve":
      return "badge badge-tertiary";
    case "reject":
      return "badge badge-error";
    case "request_changes":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function ApprovalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { whoami } = useShell();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [decideForm, setDecideForm] = useState({ decision: "approve", reason: "" });
  const [delegateForm, setDelegateForm] = useState({ toEmployeeId: "", endDate: "", reason: "" });
  const [employees, setEmployees] = useState<Array<{ id: string; displayName: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/instances/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      const d = await res.json();
      setData(d);
      setDecideForm((f) => ({ ...f, reason: "" }));
      const empRes = await fetch("/api/org/employees", { cache: "no-store" }).catch(() => null);
      if (empRes && empRes.ok) {
        const ed = await empRes.json().catch(() => ({}));
        const list = (ed.employees ?? ed.items ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName ?? e.name ?? e.id }));
        setEmployees(list);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const instance = data?.instance;
  const currentStep = data?.steps?.find((s: any) => s.stepNumber === instance?.currentStepNumber);
  const isRequester = !!whoami?.employeeId && instance?.requesterEmployeeId === whoami.employeeId;
  const canAct = instance?.status === "pending";

  async function decide(decision: string) {
    setMsg(null);
    if (decision !== "approve" && !decideForm.reason.trim()) {
      setMsg({ type: "error", text: "Reason is required for reject / request changes." });
      return;
    }
    const res = await fetch(`/api/approvals/instances/${id}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, reason: decideForm.reason.trim(), subjectVersion: instance?.subjectVersion }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: d.error ?? `Failed (${res.status})` });
      return;
    }
    setMsg({ type: "ok", text: `Decision recorded: ${decision}` });
    setDecideForm({ decision: "approve", reason: "" });
    load();
  }

  async function delegate() {
    setMsg(null);
    if (!delegateForm.toEmployeeId) {
      setMsg({ type: "error", text: "Select a delegate." });
      return;
    }
    const res = await fetch(`/api/approvals/instances/${id}/delegate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(delegateForm),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: d.error ?? `Failed (${res.status})` });
      return;
    }
    setMsg({ type: "ok", text: "Delegated." });
    setDelegateForm({ toEmployeeId: "", endDate: "", reason: "" });
    load();
  }

  async function withdraw() {
    setMsg(null);
    const res = await fetch(`/api/approvals/instances/${id}/withdraw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: decideForm.reason.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: d.error ?? `Failed (${res.status})` });
      return;
    }
    setMsg({ type: "ok", text: "Withdrawn." });
    load();
  }

  async function escalate() {
    setMsg(null);
    const res = await fetch(`/api/approvals/instances/${id}/escalate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: decideForm.reason.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ type: "error", text: d.error ?? `Failed (${res.status})` });
      return;
    }
    setMsg({ type: "ok", text: `Escalated to ${d.escalatedTo?.length ?? 0} approver(s).` });
    load();
  }

  if (loading) return <div className="page-stack"><div className="state-panel state-panel-empty">Loading…</div></div>;
  if (error) return <div className="page-stack"><div className="state-panel state-panel-error">{error}</div></div>;
  if (!instance) return <div className="page-stack"><div className="state-panel state-panel-empty">Not found.</div></div>;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1 className="mono">
            {instance.subjectType} · {String(instance.subjectId).slice(0, 8)}
          </h1>
          <p className="muted">
            Requester <span className="mono">{String(instance.requesterEmployeeId).slice(0, 8)}</span> ·{" "}
            <span className={statusBadge(instance.status)}>{instance.status}</span>
            {instance.overdue && <span className="badge badge-error">overdue</span>}
          </p>
        </div>
      </header>

      {msg && <div className={`state-panel state-panel-${msg.type === "ok" ? "ok" : "error"}`}>{msg.text}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Subject</h2>
          <span className="muted mono">version {String(instance.subjectVersion).slice(0, 24)}</span>
        </div>
        {instance.subjectContext ? (
          <ul className="detail-list">
            {Object.entries(instance.subjectContext).map(([k, v]) => (
              <li key={k}>
                <span className="muted">{k}</span> <span className="mono">{String(v)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No subject context.</p>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Steps</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Mode</th>
              <th>Min</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.steps.map((s: any) => (
              <tr key={s.id} className={s.stepNumber === instance.currentStepNumber ? "row-group" : ""}>
                <td>{s.stepNumber}</td>
                <td>{s.name}</td>
                <td className="mono">{s.mode}</td>
                <td>{s.minApprovals}</td>
                <td>
                  <span className={statusBadge(s.status)}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Decision history</h2>
        </div>
        {data.decisions.length === 0 ? (
          <div className="state-panel state-panel-empty">No decisions yet.</div>
        ) : (
          <ul className="history-list">
            {data.decisions.map((d: any) => (
              <li key={d.id}>
                <span className={decisionBadge(d.decision)}>{d.decision}</span>{" "}
                <span className="mono">{String(d.approverEmployeeId).slice(0, 8)}</span>
                {d.isSodOverride && <span className="badge badge-error">SOD override</span>}
                {d.reason && <div className="muted">{d.reason}</div>}
                <div className="muted mono">{new Date(d.decidedAt).toISOString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canAct && !isRequester && (
        <div className="panel">
          <div className="panel-head">
            <h2>Decide</h2>
            <span className="muted mono">step {currentStep?.stepNumber ?? "—"}</span>
          </div>
          <div className="inline-form">
            <input
              className="input"
              placeholder="Reason (required for reject / request changes)"
              value={decideForm.reason}
              onChange={(e) => setDecideForm({ ...decideForm, reason: e.target.value })}
            />
            <div className="action-row">
              <button className="btn btn-primary" onClick={() => decide("approve")}>
                Approve
              </button>
              <button className="btn btn-secondary" onClick={() => decide("request_changes")}>
                Request changes
              </button>
              <button className="btn btn-danger" onClick={() => decide("reject")}>
                Reject
              </button>
              <button className="btn btn-secondary" onClick={escalate}>
                Escalate
              </button>
            </div>
          </div>
          <div className="inline-form">
            <select
              className="input"
              value={delegateForm.toEmployeeId}
              onChange={(e) => setDelegateForm({ ...delegateForm, toEmployeeId: e.target.value })}
            >
              <option value="">Delegate to…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="date"
              value={delegateForm.endDate}
              onChange={(e) => setDelegateForm({ ...delegateForm, endDate: e.target.value })}
            />
            <button className="btn btn-secondary" onClick={delegate}>
              Delegate
            </button>
          </div>
        </div>
      )}

      {canAct && isRequester && (
        <div className="panel">
          <div className="panel-head">
            <h2>Requester actions</h2>
          </div>
          <div className="inline-form">
            <input
              className="input"
              placeholder="Withdraw reason (optional)"
              value={decideForm.reason}
              onChange={(e) => setDecideForm({ ...decideForm, reason: e.target.value })}
            />
            <button className="btn btn-secondary" onClick={withdraw}>
              Withdraw
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
