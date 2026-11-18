"use client";

import React, { useState } from "react";
import { X, Award, ShieldCheck } from "lucide-react";

interface CertificationSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    skillName: string;
    proficiencyLevel: string;
    issuingAuthority: string;
    credentialId?: string;
    verificationUrl?: string;
    issuedAt?: string;
    expiresAt?: string;
  }) => Promise<void>;
}

export function CertificationSubmissionModal({
  isOpen,
  onClose,
  onSubmit,
}: CertificationSubmissionModalProps) {
  const [skillName, setSkillName] = useState("");
  const [proficiencyLevel, setProficiencyLevel] = useState("intermediate");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split("T")[0]);
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!skillName || !issuingAuthority) {
      setError("Skill name and issuing authority are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        skillName,
        proficiencyLevel,
        issuingAuthority,
        credentialId: credentialId || undefined,
        verificationUrl: verificationUrl || undefined,
        issuedAt: issuedAt || undefined,
        expiresAt: expiresAt || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to submit certification");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Submit Skill Certification
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Skill or Certification Name *
            </label>
            <input
              type="text"
              placeholder="e.g. AWS Certified Solutions Architect, Kubernetes (CKA), React"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Proficiency Level *
              </label>
              <select
                value={proficiencyLevel}
                onChange={(e) => setProficiencyLevel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Issuing Authority *
              </label>
              <input
                type="text"
                placeholder="e.g. Amazon Web Services, Linux Foundation"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Credential ID (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. AWS-PSA-10827"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Verification URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://credly.com/..."
                value={verificationUrl}
                onChange={(e) => setVerificationUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Expiration Date (Optional)
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 text-xs text-slate-400 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Once submitted, a technical manager will verify the credential and generate an immutable SHA-256 cryptographic audit proof.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
            >
              {isSubmitting ? "Submitting..." : "Submit for Verification"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
