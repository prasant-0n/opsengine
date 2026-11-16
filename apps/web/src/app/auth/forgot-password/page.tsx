"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLockup, BrandMark } from "@/components/layout/brand";

export default function ForgotPasswordPage() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUsername, purpose: "password_reset" }),
      });
      if (!res.ok) throw new Error("Failed to send code");
      const data = await res.json();
      if (data.codeSent) {
        if (data.challengeId) {
          window.location.href = `/auth/verify-otp?challenge=${encodeURIComponent(data.challengeId)}`;
          return;
        }
        setSent(true);
      }
    } catch {
      setError("Unable to dispatch code. Contact platform security operations.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-shell">
        <header className="auth-topbar">
          <BrandLockup env="Root Recovery Channel" />
          <span className="badge badge-tertiary">
            <span className="status-dot" />
            Code Dispatched
          </span>
        </header>

        <main className="auth-content">
          <div className="form-container">
            <div className="form-header">
              <div className="form-mark">
                <BrandMark size={40} />
              </div>
              <h1 className="form-title">Code Dispatched</h1>
              <p className="form-subtitle">
                A 6-digit verification code has been sent to your registered
                superadmin email. Code expires in 10 minutes.
              </p>
            </div>

            <div className="alert alert-error" role="status">
              <span className="material-symbols-outlined icon-sm">info</span>
              <span>
                Protected root recovery channel. If you lost access to your
                primary email, contact platform security operations.
              </span>
            </div>

            <Link
              href="/auth/verify-otp"
              className="btn btn-primary w-full mt-5"
            >
              Enter Verification Code
              <span className="material-symbols-outlined icon-inline">
                arrow_forward
              </span>
            </Link>

            <div className="mt-4 text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-fixed transition-colors"
              >
                <span className="material-symbols-outlined icon-sm">
                  arrow_back
                </span>
                Back to Sign In
              </Link>
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

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <BrandLockup env="Root Recovery Channel" />
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
            <h1 className="form-title">Reset Root Password</h1>
            <p className="form-subtitle">
              Enter your root administrator email address or superadmin username
              to receive a password reset code.
            </p>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="alert alert-error" role="alert">
                <span className="material-symbols-outlined icon-sm">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-field">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="form-label mb-0" htmlFor="emailOrUsername">
                    Root Email or Username
                  </label>
                  <span className="badge badge-tertiary">
                    Primary Channel
                  </span>
                </div>
                <div className="form-input-group">
                  <span className="material-symbols-outlined form-input-icon-left">
                    mail
                  </span>
                  <input
                    id="emailOrUsername"
                    type="text"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    placeholder="admin@platform.opsengine.com"
                    required
                    disabled={loading}
                    className="input pl-9"
                    autoComplete="username"
                  />
                </div>
                <p className="form-hint">
                  <span className="material-symbols-outlined icon-sm">
                    info
                  </span>
                  A 6-digit one-time verification code will be sent to your
                  registered superadmin email.
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  "Dispatching Code..."
                ) : (
                  <>
                    Send Verification Code
                    <span className="material-symbols-outlined icon-inline">
                      send
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-5 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-fixed transition-colors"
            >
              <span className="material-symbols-outlined icon-sm">
                arrow_back
              </span>
              Back to Sign In
            </Link>
          </div>

          <div className="break-glass-footer">
            <span className="break-glass-icon text-error">
              <span className="material-symbols-outlined icon-sm">warning</span>
            </span>
            <span className="break-glass-text">
              Protected root recovery channel. If you have lost access to your
              primary email, contact platform security operations immediately.
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
