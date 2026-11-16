"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShell } from "@/components/layout/shell-context";

function statusBadge(status: string): string {
  switch (status) {
    case "completed":
    case "done":
      return "badge badge-tertiary";
    case "in_progress":
    case "active":
      return "badge badge-primary";
    case "blocked":
    case "cancelled":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function OnboardingPlanDetailPage() {
  const { can } = useShell();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [taskForm, setTaskForm] = useState({ title: "", ownerRole: "", dueOn: "" });
  const [inductionForm, setInductionForm] = useState({ title: "", startAt: "", endAt: "", location: "" });
  const [policyForm, setPolicyForm] = useState({ policyName: "", policyVersion: "" });
  const [buddyId, setBuddyId] = useState("");
  const [probationForm, setProbationForm] = useState({ dueOn: "", managerEmployeeId: "" });
  const [decision, setDecision] = useState({ recommendation: "confirm", newEndOn: "", managerFeedback: "" });

  const canUpdate = can("onboarding.plan.update");
  const canTask = can("onboarding.task.manage");
  const canInduction = can("onboarding.induction.manage");
  const canReview = can("onboarding.probation.review");
  const canDecide = can("onboarding.probation.decide");
  const canConvert = can("onboarding.convert_employee");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/plans/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      const d = await res.json();
      setData(d);
      setBuddyId(d.plan?.buddyEmployeeId ?? "");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canUpdate && !canReview) return;
    fetch("/api/people", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => setEmployees(d.employees ?? []))
      .catch(() => {});
  }, [canUpdate, canReview]);

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

  const plan = data.plan;
  const tasks = data.tasks ?? [];
  const induction = data.induction ?? [];
  const acknowledgements = data.policies ?? [];
  const probation = data.probation ?? [];

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>{data.candidate?.fullName ?? "Onboarding plan"}</h1>
          <p className="muted">
            {data.offer?.jobTitle ?? "—"} · <span className={statusBadge(plan.status)}>{plan.status}</span> · {plan.completionPct ?? 0}% complete
          </p>
        </div>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Tasks</h2>
        </div>
        {tasks.length === 0 ? (
          <div className="state-panel state-panel-empty">No tasks.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Owner role</th>
                <th>Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.ownerRole ?? "—"}</td>
                  <td className="mono">{t.dueOn ? new Date(t.dueOn).toISOString().slice(0, 10) : "—"}</td>
                  <td>
                    <span className={statusBadge(t.status)}>{t.status}</span>
                  </td>
                  <td>
                    {canTask && t.status !== "done" && (
                      <div className="action-row">
                        <button className="link" disabled={busy} onClick={() => act(`/api/onboarding/tasks/${t.id}/complete`, {})}>
                          Complete
                        </button>
                        {t.status !== "blocked" && (
                          <button className="link" disabled={busy} onClick={() => act(`/api/onboarding/tasks/${t.id}/block`, { reason: "manual" })}>
                            Block
                          </button>
                        )}
                        <button className="link" disabled={busy} onClick={() => act(`/api/onboarding/tasks/${t.id}/waive`, { reason: "manual" })}>
                          Waive
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canTask && (
          <div className="inline-form">
            <input className="input" placeholder="New task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
            <input className="input" placeholder="Owner role" value={taskForm.ownerRole} onChange={(e) => setTaskForm({ ...taskForm, ownerRole: e.target.value })} />
            <input className="input" type="date" value={taskForm.dueOn} onChange={(e) => setTaskForm({ ...taskForm, dueOn: e.target.value })} />
            <button className="btn btn-secondary" disabled={busy || !taskForm.title} onClick={async () => { const ok = await act(`/api/onboarding/plans/${id}/tasks`, taskForm); if (ok) setTaskForm({ title: "", ownerRole: "", dueOn: "" }); }}>
              Add task
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Induction</h2>
        </div>
        {induction.length === 0 ? (
          <div className="state-panel state-panel-empty">No induction events.</div>
        ) : (
          <ul className="history-list">
            {induction.map((e: any) => (
              <li key={e.id}>
                <span>{e.title}</span>
                <span className="muted mono">{e.startAt ? new Date(e.startAt).toISOString().slice(0, 16) : "—"}</span>
                <span className="muted">{e.location ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
        {canInduction && (
          <div className="inline-form">
            <input className="input" placeholder="Event title" value={inductionForm.title} onChange={(e) => setInductionForm({ ...inductionForm, title: e.target.value })} />
            <input className="input" type="datetime-local" value={inductionForm.startAt} onChange={(e) => setInductionForm({ ...inductionForm, startAt: e.target.value })} />
            <input className="input" type="datetime-local" value={inductionForm.endAt} onChange={(e) => setInductionForm({ ...inductionForm, endAt: e.target.value })} />
            <input className="input" placeholder="Location" value={inductionForm.location} onChange={(e) => setInductionForm({ ...inductionForm, location: e.target.value })} />
            <button className="btn btn-secondary" disabled={busy || !inductionForm.title || !inductionForm.startAt || !inductionForm.endAt} onClick={async () => { const ok = await act(`/api/onboarding/plans/${id}/induction`, inductionForm); if (ok) setInductionForm({ title: "", startAt: "", endAt: "", location: "" }); }}>
              Add event
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Buddy</h2>
        </div>
        {canUpdate ? (
          <div className="inline-form">
            <select className="input" value={buddyId} onChange={(e) => setBuddyId(e.target.value)}>
              <option value="">— none —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/api/onboarding/plans/${id}/buddy`, { buddyEmployeeId: buddyId || null })}>
              Save buddy
            </button>
          </div>
        ) : (
          <p className="muted">{plan.buddyEmployeeId ?? "No buddy assigned."}</p>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Policy acknowledgements</h2>
        </div>
        {acknowledgements.length === 0 ? (
          <div className="state-panel state-panel-empty">No acknowledgements.</div>
        ) : (
          <ul className="history-list">
            {acknowledgements.map((a: any) => (
              <li key={a.id}>
                <span>{a.policyName}</span>
                <span className="muted mono">v{a.policyVersion}</span>
                <span className="muted mono">{a.acknowledgedAt ? new Date(a.acknowledgedAt).toISOString().slice(0, 10) : "—"}</span>
              </li>
            ))}
          </ul>
        )}
        {canUpdate && (
          <div className="inline-form">
            <input className="input" placeholder="Policy name" value={policyForm.policyName} onChange={(e) => setPolicyForm({ ...policyForm, policyName: e.target.value })} />
            <input className="input" placeholder="Version" value={policyForm.policyVersion} onChange={(e) => setPolicyForm({ ...policyForm, policyVersion: e.target.value })} />
            <button className="btn btn-secondary" disabled={busy || !policyForm.policyName || !policyForm.policyVersion} onClick={async () => { const ok = await act(`/api/onboarding/plans/${id}/policy-ack`, policyForm); if (ok) setPolicyForm({ policyName: "", policyVersion: "" }); }}>
              Record acknowledgement
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Probation</h2>
        </div>
        {probation.length === 0 ? (
          <div className="state-panel state-panel-empty">No probation review.</div>
        ) : (
          probation.map((r: any) => (
            <div key={r.id} className="detail-list">
              <dt>Status</dt>
              <dd>
                <span className={statusBadge(r.status)}>{r.status}</span>
              </dd>
              <dt>Start</dt>
              <dd className="mono">{r.startOn ? new Date(r.startOn).toISOString().slice(0, 10) : "—"}</dd>
              <dt>Due</dt>
              <dd className="mono">{r.dueOn ? new Date(r.dueOn).toISOString().slice(0, 10) : "—"}</dd>
              <dt>Recommendation</dt>
              <dd>{r.recommendation ?? "—"}</dd>
              {r.status !== "completed" && canDecide && (
                <>
                  <dt>Decision</dt>
                  <dd>
                    <div className="inline-form">
                      <select className="input" value={decision.recommendation} onChange={(e) => setDecision({ ...decision, recommendation: e.target.value })}>
                        <option value="confirm">confirm</option>
                        <option value="extend">extend</option>
                        <option value="terminate">terminate</option>
                      </select>
                      {decision.recommendation === "extend" && (
                        <input className="input" type="date" value={decision.newEndOn} onChange={(e) => setDecision({ ...decision, newEndOn: e.target.value })} />
                      )}
                      <input className="input" placeholder="Feedback" value={decision.managerFeedback} onChange={(e) => setDecision({ ...decision, managerFeedback: e.target.value })} />
                      <button className="btn btn-primary" disabled={busy} onClick={() => act(`/api/onboarding/probation/${r.id}/decide`, decision)}>
                        Record decision
                      </button>
                    </div>
                  </dd>
                </>
              )}
            </div>
          ))
        )}
        {canReview && probation.every((r: any) => r.status === "completed") && (
          <div className="inline-form">
            <input className="input" type="date" placeholder="Due date" value={probationForm.dueOn} onChange={(e) => setProbationForm({ ...probationForm, dueOn: e.target.value })} />
            <select className="input" value={probationForm.managerEmployeeId} onChange={(e) => setProbationForm({ ...probationForm, managerEmployeeId: e.target.value })}>
              <option value="">— manager —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" disabled={busy || !probationForm.dueOn} onClick={async () => { const ok = await act(`/api/onboarding/plans/${id}/probation`, probationForm); if (ok) setProbationForm({ dueOn: "", managerEmployeeId: "" }); }}>
              Create probation review
            </button>
          </div>
        )}
      </div>

      {canConvert && (
        <div className="panel">
          <div className="panel-head">
            <h2>Conversion</h2>
          </div>
          {plan.createdEmployeeId ? (
            <p className="muted mono">Converted → employee {plan.createdEmployeeId}</p>
          ) : (
            <div className="action-row">
              <button className="btn btn-primary" disabled={busy} onClick={() => act(`/api/onboarding/plans/${id}/convert`, {})}>
                Convert to employee
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
