"use client";

import React, { useState } from "react";
import { ShieldCheck, Award, CheckCircle2 } from "lucide-react";
import { ProficiencyLevel } from "../lib/lms-engine";

export interface SkillCertItem {
  id: string;
  tenantId: string;
  employeeId: string;
  skillName: string;
  proficiencyLevel: ProficiencyLevel;
  issuingAuthority: string;
  credentialId?: string | null;
  verificationUrl?: string | null;
  status: "pending_verification" | "verified" | "expired" | "rejected";
  verificationHash?: string | null;
  verifiedAt?: string | null;
  issuedAt: string;
  expiresAt?: string | null;
}

interface SkillMatrixBoardProps {
  certifications: SkillCertItem[];
  onOpenSubmitModal: () => void;
  onVerifyCert?: (certId: string, action: "verify" | "reject") => Promise<void>;
  isManager?: boolean;
}

export function SkillMatrixBoard({
  certifications,
  onOpenSubmitModal,
  onVerifyCert,
  isManager = false,
}: SkillMatrixBoardProps) {
  const [viewMode, setViewMode] = useState<"skills" | "records">("skills");
  const [actioningId, setActioningId] = useState<string | null>(null);

  const verifiedCerts = certifications.filter((c) => c.status === "verified");
  const pendingCerts = certifications.filter((c) => c.status === "pending_verification");

  // Group by skill
  const skillMap = new Map<
    string,
    {
      beginner: number;
      intermediate: number;
      advanced: number;
      expert: number;
      total: number;
      issuers: Set<string>;
    }
  >();

  for (const cert of verifiedCerts) {
    if (!skillMap.has(cert.skillName)) {
      skillMap.set(cert.skillName, {
        beginner: 0,
        intermediate: 0,
        advanced: 0,
        expert: 0,
        total: 0,
        issuers: new Set(),
      });
    }
    const entry = skillMap.get(cert.skillName)!;
    const level = (cert.proficiencyLevel || "intermediate") as ProficiencyLevel;
    if (entry[level] !== undefined) {
      entry[level]++;
    }
    entry.total++;
    entry.issuers.add(cert.issuingAuthority);
  }

  const skillEntries = Array.from(skillMap.entries());

  const handleVerify = async (certId: string, action: "verify" | "reject") => {
    if (!onVerifyCert) return;
    setActioningId(certId);
    try {
      await onVerifyCert(certId, action);
    } finally {
      setActioningId(null);
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "expert":
        return "bg-purple-950 text-purple-400 border-purple-800";
      case "advanced":
        return "bg-blue-950 text-blue-400 border-blue-800";
      case "intermediate":
        return "bg-emerald-950 text-emerald-400 border-emerald-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action & stat bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-slate-400">Total Verified Certs</span>
            <p className="text-xl font-bold text-slate-100">{verifiedCerts.length}</p>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-xs text-slate-400">Distinct Competencies</span>
            <p className="text-xl font-bold text-slate-100">{skillEntries.length}</p>
          </div>
          {pendingCerts.length > 0 && (
            <div className="border-l border-slate-800 pl-6">
              <span className="text-xs text-amber-400">Pending Verification</span>
              <p className="text-xl font-bold text-amber-400">{pendingCerts.length}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setViewMode("skills")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "skills" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Skill Matrix
            </button>
            <button
              onClick={() => setViewMode("records")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "records" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Records ({certifications.length})
            </button>
          </div>

          <button
            onClick={onOpenSubmitModal}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Award className="h-3.5 w-3.5" />
            <span>Add Certification</span>
          </button>
        </div>
      </div>

      {/* Pending verification alerts for manager/HR */}
      {isManager && pendingCerts.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-medium text-sm">
            <ShieldCheck className="h-4 w-4" />
            <span>Pending Manager Verifications ({pendingCerts.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingCerts.map((cert) => (
              <div
                key={cert.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">{cert.skillName}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded capitalize border ${getLevelBadge(
                        cert.proficiencyLevel
                      )}`}
                    >
                      {cert.proficiencyLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Issued by: {cert.issuingAuthority}
                    {cert.credentialId ? ` • Credential: ${cert.credentialId}` : ""}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    disabled={actioningId === cert.id}
                    onClick={() => handleVerify(cert.id, "reject")}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700"
                  >
                    Reject
                  </button>
                  <button
                    disabled={actioningId === cert.id}
                    onClick={() => handleVerify(cert.id, "verify")}
                    className="px-3 py-1 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Verify & Hash</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matrix view */}
      {viewMode === "skills" ? (
        skillEntries.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
            <Award className="mx-auto h-12 w-12 text-slate-600 mb-3" />
            <h3 className="text-lg font-medium text-slate-300">No verified skills yet</h3>
            <p className="text-sm text-slate-500 mt-1">
              Submit certifications to populate the enterprise technical skill matrix.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skillEntries.map(([skillName, data]) => (
              <div
                key={skillName}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-100">{skillName}</h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-400 font-semibold border border-blue-800/60">
                    {data.total} Certified
                  </span>
                </div>

                {/* Level breakdown pills */}
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div className="bg-slate-800/60 rounded p-1.5 border border-slate-700/50">
                    <span className="block text-[10px] text-slate-400 uppercase">Beg</span>
                    <span className="text-xs font-bold text-slate-200">{data.beginner}</span>
                  </div>
                  <div className="bg-emerald-950/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="block text-[10px] text-emerald-400 uppercase">Int</span>
                    <span className="text-xs font-bold text-emerald-300">{data.intermediate}</span>
                  </div>
                  <div className="bg-blue-950/30 rounded p-1.5 border border-blue-800/40">
                    <span className="block text-[10px] text-blue-400 uppercase">Adv</span>
                    <span className="text-xs font-bold text-blue-300">{data.advanced}</span>
                  </div>
                  <div className="bg-purple-950/30 rounded p-1.5 border border-purple-800/40">
                    <span className="block text-[10px] text-purple-400 uppercase">Exp</span>
                    <span className="text-xs font-bold text-purple-300">{data.expert}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 truncate">
                  Authorities: {Array.from(data.issuers).join(", ")}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Records view */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Skill & Authority</th>
                  <th className="px-4 py-3">Proficiency</th>
                  <th className="px-4 py-3">Credential ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Integrity Proof (SHA-256)</th>
                  <th className="px-4 py-3">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {certifications.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-200">
                      <div>{cert.skillName}</div>
                      <div className="text-[10px] text-slate-500">{cert.issuingAuthority}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded capitalize border ${getLevelBadge(
                          cert.proficiencyLevel
                        )}`}
                      >
                        {cert.proficiencyLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {cert.credentialId || "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {cert.status === "verified" ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </span>
                      ) : cert.status === "pending_verification" ? (
                        <span className="text-amber-400">Pending</span>
                      ) : (
                        <span className="text-slate-500">{cert.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-400 max-w-[180px] truncate">
                      {cert.verificationHash ? (
                        <span
                          className="text-blue-400 hover:text-blue-300 cursor-help"
                          title={cert.verificationHash}
                        >
                          {cert.verificationHash.slice(0, 16)}...
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(cert.issuedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
