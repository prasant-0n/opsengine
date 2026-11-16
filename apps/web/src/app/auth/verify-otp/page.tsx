"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLockup, BrandMark } from "@/components/layout/brand";

export default function VerifyOtpPage() {
  const [code, setCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(45);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const challenge = params.get("challenge");
    if (challenge) {
      setChallengeId(challenge);
    } else {
      setError("Missing verification challenge. Please request a new code.");
    }
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const digits = code.split("").slice(0, 6);

  const handleDigitInput = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length > 1) return;
    const next = code.slice(0, index) + val + code.slice(index + 1);
    setCode(next);
    if (val && index < 5) {
      const input = document.querySelectorAll<HTMLInputElement>("input[data-otp]")[index + 1];
      input?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    setCode(pasted.padEnd(6, " "));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) {
      setError("Missing verification challenge. Please request a new code.");
      return;
    }
    if (code.replace(/\s/g, "").length !== 6) {
      setError("Enter all 6 digits");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code: code.replace(/\s/g, ""),
          purpose: "password_reset",
        }),
      });
      if (!res.ok) throw new Error("Invalid code");
      setVerified(true);
    } catch {
      setError("Invalid or expired code. Request a new one.");
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="auth-shell">
        <header className="auth-topbar">
          <BrandLockup env="Email Verification" />
          <span className="badge badge-tertiary">
            <span className="status-dot" />
            Verified
          </span>
        </header>

        <main className="auth-content">
          <div className="form-container">
            <div className="form-header">
              <div className="form-mark">
                <BrandMark size={40} />
              </div>
              <h1 className="form-title">Code Verified</h1>
              <p className="form-subtitle">
                Your code has been verified successfully.
              </p>
            </div>

            <Link href="/auth/login" className="btn btn-primary w-full">
              Continue to Sign In
              <span className="material-symbols-outlined icon-inline">
                arrow_forward
              </span>
            </Link>

            <div className="break-glass-footer">
              <span className="break-glass-icon text-primary">
                <span className="material-symbols-outlined icon-sm">
                  verified_user
                </span>
              </span>
              <span className="break-glass-text">
                Hardware Key &amp; Break-Glass Protocol Active · OpsEngine Cloud
                Orchestration · Isolated Partition
              </span>
            </div>
          </div>
        </main>

        <footer className="auth-page-footer">
          <span className="auth-footer-text">
            © 2026 OpsEngine — Enterprise Operations Platform
          </span>
          <span className="auth-footer-text">
            Multi-Tenant Isolation Active · SOC 2 Type II · ISO 27001
          </span>
        </footer>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <BrandLockup env="Email Verification" />
        <span className="badge badge-outline">
          <span className="material-symbols-outlined icon-sm">lock</span>
          TLS 1.3 Encrypted
        </span>
      </header>

      <main className="auth-content">
        <div className="form-container">
          <div className="form-header">
            <div className="form-mark">
              <BrandMark size={40} />
            </div>
            <h1 className="form-title">Check your email</h1>
            <p className="form-subtitle">
              We sent a 6-digit verification code to{" "}
              <span className="font-mono font-medium text-on-surface">
                root@opsengine.internal
              </span>
              <button
                onClick={() => {}}
                className="text-xs text-primary underline underline-offset-4 hover:text-primary-fixed cursor-pointer ml-1"
              >
                (Edit)
              </button>
            </p>
          </div>

          <div className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-field">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="form-label mb-0">Verification Passcode</label>
                  <span className="badge badge-primary">
                    <span className="material-symbols-outlined icon-sm">
                      content_paste
                    </span>
                    Paste Ready
                  </span>
                </div>
                <div className="otp-grid">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      data-otp
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digits[i] || ""}
                      onChange={(e) => handleDigitInput(e, i)}
                      onPaste={handlePaste}
                      autoComplete="one-time-code"
                      className="otp-input"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 text-outline">
                  <span className="material-symbols-outlined icon-sm">
                    schedule
                  </span>
                  <span className="text-on-surface font-medium">
                    Resend in {String(resendSeconds).padStart(2, "0")}s
                  </span>
                </div>
                <button
                  disabled={resendSeconds > 0}
                  className="text-xs text-outline hover:text-on-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Resend Code
                  <span className="material-symbols-outlined icon-sm">
                    refresh
                  </span>
                </button>
              </div>

              {error && (
                <div className="alert alert-error" role="alert">
                  <span className="material-symbols-outlined icon-sm">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || !challengeId || code.replace(/\s/g, "").length !== 6}
              >
                {loading ? (
                  "Verifying..."
                ) : (
                  <>
                    Verify &amp; Continue
                    <span className="material-symbols-outlined icon-inline">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>

              <div className="text-center">
                <Link
                  href="/auth/forgot-password"
                  className="inline-flex items-center gap-1 text-xs text-outline hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined icon-sm">
                    arrow_back
                  </span>
                  Back to password reset
                </Link>
              </div>
            </form>

            <div className="rounded-sm border border-outline-30 bg-input/50 p-3 flex items-start gap-2">
              <span className="material-symbols-outlined icon-sm text-primary mt-0.5">
                lightbulb
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-mono text-outline uppercase tracking-wider">
                  Helpful Tip
                </p>
                <p className="text-[10px] text-outline leading-relaxed">
                  Check your spam or junk folder if you don&apos;t see the email
                  within 2 minutes. Multi-tenant relay delays may rarely occur.
                </p>
              </div>
            </div>
          </div>

          <div className="break-glass-footer">
            <span className="break-glass-icon text-primary">
              <span className="material-symbols-outlined icon-sm">
                verified_user
              </span>
            </span>
            <span className="break-glass-text">
              Hardware Key &amp; Break-Glass Protocol Active · OpsEngine Cloud
              Orchestration · Isolated Partition
            </span>
          </div>
        </div>
      </main>

      <footer className="auth-page-footer">
        <span className="auth-footer-text">
          © 2026 OpsEngine — Enterprise Operations Platform
        </span>
        <span className="auth-footer-text">
          Multi-Tenant Isolation Active · SOC 2 Type II · ISO 27001
        </span>
      </footer>
    </div>
  );
}
