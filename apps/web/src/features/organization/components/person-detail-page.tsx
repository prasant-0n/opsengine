"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";

interface EmployeeDetail {
  id: string;
  displayName: string;
  employeeNumber: string | null;
  workEmail: string | null;
  jobTitle: string | null;
  jobFamily: string | null;
  grade: string | null;
  seniority: string | null;
  department: string | null;
  employmentType: string | null;
  location: string | null;
  startDate: string | null;
  probationEndsAt: string | null;
  employmentStatus: string;
}

const FIELDS: Array<{ key: keyof EmployeeDetail; label: string; mono?: boolean }> = [
  { key: "employeeNumber", label: "Employee #", mono: true },
  { key: "workEmail", label: "Work email", mono: true },
  { key: "jobTitle", label: "Job title" },
  { key: "jobFamily", label: "Job family" },
  { key: "grade", label: "Grade", mono: true },
  { key: "seniority", label: "Seniority" },
  { key: "department", label: "Department" },
  { key: "employmentType", label: "Employment type" },
  { key: "location", label: "Location" },
  { key: "startDate", label: "Start date", mono: true },
  { key: "probationEndsAt", label: "Probation ends", mono: true },
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<EmployeeDetail | null>(null);
  const [redacted, setRedacted] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/org/employees/${params.id}`);
        if (res.status === 404) {
          if (!cancelled) notFound();
          return;
        }
        if (res.status === 403) {
          if (!cancelled) setState("denied");
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          setRow(data.employee);
          setRedacted(data.redactedFields ?? []);
          setState("ok");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (state === "loading") {
    return (
      <div className="page-stack">
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-body animate-pulse">Loading profile…</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">Employee profile</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
              lock
            </span>
            <p className="state-panel-title">Permission denied</p>
            <p className="state-panel-note mono">missing: org.read_directory (or out of scope)</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error" || !row) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">Employee profile</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-title">Failed to load employee</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <Link href="/dashboard/people" className="btn btn-ghost btn-sm">
            ← Directory
          </Link>
          <h1 className="font-headline-lg" style={{ marginTop: 8 }}>
            {row.displayName}
          </h1>
          <p className="page-subtitle">
            {[row.jobTitle, row.department].filter(Boolean).join(" · ") || "Profile"}
          </p>
        </div>
        <span className="badge badge-primary">{row.employmentStatus}</span>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Profile</h2>
          <span className="font-label-sm text-outline-60">
            restricted fields redacted server-side
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <tbody>
              {FIELDS.map((f) => {
                const raw = row[f.key];
                const display =
                  f.key === "startDate" || f.key === "probationEndsAt"
                    ? formatDate(raw as string | null)
                    : (raw as string | null) || "—";
                const isRedacted = redacted.includes(f.key);
                return (
                  <tr key={f.key}>
                    <th scope="row" style={{ width: 240, textAlign: "left", fontWeight: 500 }}>
                      {f.label}
                    </th>
                    <td className={f.mono ? "mono" : undefined}>
                      {isRedacted ? (
                        <span className="text-outline-60">restricted</span>
                      ) : (
                        display
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
