"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import {
  REQUISITION_STATUSES,
  INTERVIEW_TYPES,
} from "@/features/recruitment/lib/recruitment";

type Tab = "requisitions" | "candidates" | "interviews";

function reqBadge(status: string): string {
  switch (status) {
    case "approved":
      return "badge badge-tertiary";
    case "submitted":
      return "badge badge-primary";
    case "rejected":
    case "closed":
      return "badge badge-outline";
    default:
      return "badge badge-outline";
  }
}

function candBadge(status: string): string {
  switch (status) {
    case "accepted":
      return "badge badge-tertiary";
    case "offer_made":
    case "screening":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

function intvBadge(status: string): string {
  switch (status) {
    case "completed":
      return "badge badge-tertiary";
    case "scheduled":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RequisitionRow {
  id: string;
  jobTitle: string;
  jobFamily: string | null;
  headcount: number;
  status: string;
  hiringManagerName: string | null;
  createdAt: string;
}

interface CandidateRow {
  id: string;
  fullName: string;
  email: string;
  source: string | null;
  status: string;
  requisitionTitle: string | null;
  createdAt: string;
}

interface InterviewRow {
  id: string;
  candidateName: string | null;
  type: string;
  startAt: string;
  endAt: string;
  status: string;
  timezone: string;
}

function RequisitionsTab() {
  const { can } = useShell();
  const [rows, setRows] = useState<RequisitionRow[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ jobTitle: "", jobFamily: "", headcount: "1", budgetBand: "", justification: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/ats/requisitions?${params.toString()}`);
      if (res.status === 403) return setState("denied");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.requisitions ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!form.jobTitle.trim()) {
      setFormError("Job title is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/ats/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: form.jobTitle.trim(),
          jobFamily: form.jobFamily.trim() || null,
          headcount: parseInt(form.headcount) || 1,
          budgetBand: form.budgetBand.trim() || null,
          justification: form.justification.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error ?? "Failed to create requisition");
        return;
      }
      setForm({ jobTitle: "", jobFamily: "", headcount: "1", budgetBand: "", justification: "" });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Requisitions</h2>
        <div className="badge-row">
          <select
            className="input input-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {REQUISITION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {can("recruit.requisition.create") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "New requisition"}
            </button>
          ) : null}
        </div>
      </div>

      {showForm ? (
        <div style={{ padding: 16, borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
            <label className="font-label-sm">
              Job title *
              <input
                className="input input-sm"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="e.g. Senior Backend Engineer"
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="font-label-sm">
                Job family
                <input
                  className="input input-sm"
                  value={form.jobFamily}
                  onChange={(e) => setForm({ ...form, jobFamily: e.target.value })}
                  placeholder="Engineering"
                />
              </label>
              <label className="font-label-sm">
                Headcount
                <input
                  className="input input-sm"
                  type="number"
                  min="1"
                  value={form.headcount}
                  onChange={(e) => setForm({ ...form, headcount: e.target.value })}
                />
              </label>
            </div>
            <label className="font-label-sm">
              Budget band
              <input
                className="input input-sm"
                value={form.budgetBand}
                onChange={(e) => setForm({ ...form, budgetBand: e.target.value })}
                placeholder="120k-160k"
              />
            </label>
            <label className="font-label-sm">
              Business justification
              <textarea
                className="input input-sm"
                rows={3}
                value={form.justification}
                onChange={(e) => setForm({ ...form, justification: e.target.value })}
                placeholder="Why this hire is needed…"
              />
            </label>
            {formError ? <p className="state-panel-note mono">{formError}</p> : null}
            <div className="badge-row">
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}>
                {saving ? "Saving…" : "Create draft"}
              </button>
              <span className="state-panel-note">Approvals are governed server-side via POST /approve.</span>
            </div>
          </div>
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="panel-empty">
          <p className="state-panel-body animate-pulse">Loading requisitions…</p>
        </div>
      ) : state === "denied" ? (
        <div className="panel-empty">
          <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
            lock
          </span>
          <p className="state-panel-title">Permission denied</p>
          <p className="state-panel-note mono">missing: recruit.requisition.read</p>
        </div>
      ) : state === "error" ? (
        <div className="panel-empty">
          <p className="state-panel-title">Failed to load requisitions</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="panel-empty">
          <p className="state-panel-body">No requisitions match this view.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Job title</th>
                <th scope="col">Family</th>
                <th scope="col">Headcount</th>
                <th scope="col">Hiring manager</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/dashboard/recruit/requisitions/${r.id}`} className="link-plain">
                      {r.jobTitle}
                    </Link>
                  </td>
                  <td>{r.jobFamily ?? "—"}</td>
                  <td className="mono">{r.headcount}</td>
                  <td>{r.hiringManagerName ?? "—"}</td>
                  <td>
                    <span className={reqBadge(r.status)}>{r.status}</span>
                  </td>
                  <td className="mono">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CandidatesTab() {
  const { can } = useShell();
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [reqs, setReqs] = useState<{ id: string; jobTitle: string }[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    source: "",
    linkedRequisitionId: "",
    consent: false,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/ats/candidates");
      if (res.status === 403) return setState("denied");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.candidates ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/ats/requisitions")
      .then((r) => (r.ok ? r.json() : { requisitions: [] }))
      .then((d) => setReqs(d.requisitions ?? []))
      .catch(() => setReqs([]));
  }, [load]);

  const submit = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      setFormError("Name and email are required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/ats/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          source: form.source.trim() || null,
          linkedRequisitionId: form.linkedRequisitionId || null,
          consentGiven: form.consent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error ?? "Failed to add candidate");
        return;
      }
      setForm({ fullName: "", email: "", phone: "", source: "", linkedRequisitionId: "", consent: false });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Candidates</h2>
        <div className="badge-row">
          <span className="font-label-sm mono">{rows.length} total</span>
          {can("recruit.candidate.create") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "Add candidate"}
            </button>
          ) : null}
        </div>
      </div>

      {showForm ? (
        <div style={{ padding: 16, borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="font-label-sm">
                Full name *
                <input
                  className="input input-sm"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </label>
              <label className="font-label-sm">
                Email *
                <input
                  className="input input-sm"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="font-label-sm">
                Phone
                <input
                  className="input input-sm"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="font-label-sm">
                Source
                <input
                  className="input input-sm"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="referral, careers_page…"
                />
              </label>
            </div>
            <label className="font-label-sm">
              Linked requisition
              <select
                className="input input-sm"
                value={form.linkedRequisitionId}
                onChange={(e) => setForm({ ...form, linkedRequisitionId: e.target.value })}
              >
                <option value="">— none —</option>
                {reqs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.jobTitle}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-label-sm" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              />
              Candidate consented to processing (timestamped on save)
            </label>
            {formError ? <p className="state-panel-note mono">{formError}</p> : null}
            <div className="badge-row">
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}>
                {saving ? "Saving…" : "Add to pipeline"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="panel-empty">
          <p className="state-panel-body animate-pulse">Loading candidates…</p>
        </div>
      ) : state === "denied" ? (
        <div className="panel-empty">
          <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
            lock
          </span>
          <p className="state-panel-title">Permission denied</p>
          <p className="state-panel-note mono">missing: recruit.candidate.read</p>
        </div>
      ) : state === "error" ? (
        <div className="panel-empty">
          <p className="state-panel-title">Failed to load candidates</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="panel-empty">
          <p className="state-panel-body">No candidates yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Requisition</th>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/dashboard/recruit/candidates/${c.id}`} className="link-plain">
                      {c.fullName}
                    </Link>
                  </td>
                  <td className="mono">{c.email}</td>
                  <td>{c.requisitionTitle ?? "—"}</td>
                  <td>{c.source ?? "—"}</td>
                  <td>
                    <span className={candBadge(c.status)}>{c.status.replace("_", " ")}</span>
                  </td>
                  <td className="mono">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InterviewsTab() {
  const { can } = useShell();
  const [rows, setRows] = useState<InterviewRow[]>([]);
  const [cands, setCands] = useState<{ id: string; fullName: string }[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    candidateId: "",
    type: "phone",
    start: "",
    end: "",
    timezone: "Asia/Kolkata",
    meetingLink: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/ats/interviews");
      if (res.status === 403) return setState("denied");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.interviews ?? []);
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/ats/candidates")
      .then((r) => (r.ok ? r.json() : { candidates: [] }))
      .then((d) => setCands(d.candidates ?? []))
      .catch(() => setCands([]));
  }, [load]);

  const submit = async () => {
    if (!form.candidateId || !form.start || !form.end) {
      setFormError("Candidate, start and end are required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/ats/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: form.candidateId,
          type: form.type,
          startAt: new Date(form.start).toISOString(),
          endAt: new Date(form.end).toISOString(),
          timezone: form.timezone,
          meetingLink: form.meetingLink.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error ?? "Failed to schedule interview");
        return;
      }
      setForm({ candidateId: "", type: "phone", start: "", end: "", timezone: "Asia/Kolkata", meetingLink: "" });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Interviews</h2>
        <div className="badge-row">
          <span className="font-label-sm mono">{rows.length} scheduled</span>
          {can("recruit.interview.create") ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "Schedule"}
            </button>
          ) : null}
        </div>
      </div>

      {showForm ? (
        <div style={{ padding: 16, borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
            <label className="font-label-sm">
              Candidate *
              <select
                className="input input-sm"
                value={form.candidateId}
                onChange={(e) => setForm({ ...form, candidateId: e.target.value })}
              >
                <option value="">— select —</option>
                {cands.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="font-label-sm">
                Type
                <select
                  className="input input-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="font-label-sm">
                Timezone
                <input
                  className="input input-sm"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="font-label-sm">
                Start *
                <input
                  className="input input-sm"
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
              </label>
              <label className="font-label-sm">
                End *
                <input
                  className="input input-sm"
                  type="datetime-local"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                />
              </label>
            </div>
            <label className="font-label-sm">
              Meeting link
              <input
                className="input input-sm"
                value={form.meetingLink}
                onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
                placeholder="https://meet…"
              />
            </label>
            {formError ? <p className="state-panel-note mono">{formError}</p> : null}
            <div className="badge-row">
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}>
                {saving ? "Scheduling…" : "Schedule interview"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="panel-empty">
          <p className="state-panel-body animate-pulse">Loading interviews…</p>
        </div>
      ) : state === "denied" ? (
        <div className="panel-empty">
          <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
            lock
          </span>
          <p className="state-panel-title">Permission denied</p>
          <p className="state-panel-note mono">missing: recruit.interview.read</p>
        </div>
      ) : state === "error" ? (
        <div className="panel-empty">
          <p className="state-panel-title">Failed to load interviews</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="panel-empty">
          <p className="state-panel-body">No interviews scheduled yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Candidate</th>
                <th scope="col">Type</th>
                <th scope="col">When</th>
                <th scope="col">Timezone</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((iv) => (
                <tr key={iv.id}>
                  <td>
                    <Link href={`/dashboard/recruit/interviews/${iv.id}`} className="link-plain">
                      {iv.candidateName ?? "—"}
                    </Link>
                  </td>
                  <td>{iv.type}</td>
                  <td className="mono">
                    {fmtDateTime(iv.startAt)} – {fmtDateTime(iv.endAt)}
                  </td>
                  <td className="mono">{iv.timezone}</td>
                  <td>
                    <span className={intvBadge(iv.status)}>{iv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RecruitPage() {
  const { can } = useShell();
  const [tab, setTab] = useState<Tab>("requisitions");
  const allowed = can("recruit.requisition.read") || can("recruit.candidate.read") || can("recruit.interview.read");

  if (!allowed) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">Recruitment</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
              lock
            </span>
            <p className="state-panel-title">Permission denied</p>
            <p className="state-panel-note mono">missing: recruit.requisition.read</p>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "requisitions", label: "Requisitions" },
    { key: "candidates", label: "Candidates" },
    { key: "interviews", label: "Interviews" },
  ];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="font-headline-lg">Recruitment</h1>
          <p className="page-subtitle">
            Requisitions, pipeline and interviews · approvals enforced server-side
          </p>
        </div>
        <span className="badge badge-primary">People</span>
      </div>

      <div className="badge-row" role="tablist" aria-label="Recruitment sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "requisitions" ? <RequisitionsTab /> : null}
      {tab === "candidates" ? <CandidatesTab /> : null}
      {tab === "interviews" ? <InterviewsTab /> : null}
    </div>
  );
}
