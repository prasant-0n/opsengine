"use client";

import React, { useState } from "react";
import { X, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface SignOffModalProps {
  deliverable: any | null;
  onClose: () => void;
  onSubmit: (deliverableId: string, data: {
    status: "approved" | "changes_requested";
    signerName: string;
    signerEmail: string;
    feedbackNotes?: string;
  }) => Promise<void>;
  defaultSignerName?: string;
  defaultSignerEmail?: string;
}

export function PortalSignOffModal({
  deliverable,
  onClose,
  onSubmit,
  defaultSignerName = "",
  defaultSignerEmail = "",
}: SignOffModalProps) {
  const [status, setStatus] = useState<"approved" | "changes_requested">("approved");
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!deliverable) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || !signerEmail.trim()) {
      setError("Please provide your full legal name and work email");
      return;
    }
    if (!acknowledged) {
      setError("You must acknowledge the formal verification statement");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(deliverable.id, {
        status,
        signerName,
        signerEmail,
        feedbackNotes,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit formal sign-off");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-primary mb-1">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h3 className="text-xl font-bold text-foreground">Formal Deliverable Acceptance</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Sign-off for milestone deliverable: <strong className="text-foreground">{deliverable.title}</strong>
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Decision */}
          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">
              Review Decision *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition ${
                  status === "approved"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-semibold"
                    : "hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="approved"
                  checked={status === "approved"}
                  onChange={() => setStatus("approved")}
                  className="w-4 h-4 text-emerald-600"
                />
                <span className="text-xs">Approve & Accept</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition ${
                  status === "changes_requested"
                    ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 font-semibold"
                    : "hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="changes_requested"
                  checked={status === "changes_requested"}
                  onChange={() => setStatus("changes_requested")}
                  className="w-4 h-4 text-amber-600"
                />
                <span className="text-xs">Request Revisions</span>
              </label>
            </div>
          </div>

          {/* Signer Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Authorized Signer Name *
              </label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Authorized Signer Email *
              </label>
              <input
                type="email"
                required
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="jane@client.com"
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              {status === "approved" ? "Acceptance Notes / Feedback (Optional)" : "Required Changes & Punch-List *"}
            </label>
            <textarea
              rows={3}
              required={status === "changes_requested"}
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              placeholder={
                status === "approved"
                  ? "Approved without reservations. Quality matches specifications."
                  : "Detail specific defects, missing items, or requirements to be addressed before sign-off..."
              }
              className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Verification Checkbox */}
          <label className="flex items-start gap-2.5 p-3 bg-muted/40 border rounded-lg text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded text-blue-600"
            />
            <span>
              I certify that I am authorized to bind the client organization. A cryptographic SHA-256 digital signature will be recorded with my IP address and timestamp.
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-2 disabled:opacity-50 ${
                status === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submitting ? "Signing..." : status === "approved" ? "Execute Acceptance Sign-Off" : "Submit Revision Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
