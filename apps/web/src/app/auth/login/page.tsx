"use client";

import { useState, useEffect } from "react";
import { BrandLockup, BrandMark } from "@/components/layout/brand";

export default function LoginPage() {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (!err) return;

    switch (err) {
      case "sso_unconfigured":
        setError(
          "Google SSO is not configured on this instance. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or contact your administrator."
        );
        break;
      case "user_not_enrolled":
        setError(
          "This Google account is not enrolled in the target workspace. Please contact your administrator."
        );
        break;
      case "membership_inactive":
        setError("Your organization membership is suspended or inactive.");
        break;
      case "tenant_not_found":
        setError("Target workspace was not found or is currently inactive.");
        break;
      case "invalid_state":
        setError(
          "SSO security token expired or invalid. Please try signing in again."
        );
        break;
      case "email_not_verified":
        setError(
          "Your Google email is not verified. Please verify your email with Google first."
        );
        break;
      case "access_denied":
        setError("Google SSO sign-in was canceled.");
        break;
      default:
        setError(
          "Failed to sign in with Google SSO. Please try again or use your password."
        );
    }
  }, []);

  const handleGoogleSSO = () => {
    const params = new URLSearchParams();
    if (domain.trim()) {
      params.set("domain", domain.trim());
    }
    window.location.href = `/api/auth/google/start?${params.toString()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, email, password, rememberMe }),
      });
      if (!res.ok) throw new Error("Login failed");
      // Session cookie (httpOnly) is set by the API response; no token in URL.
      window.location.href = "/dashboard";
    } catch {
      setError("Invalid credentials or tenant. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <BrandLockup env="Secure Sign In" />
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
            <h1 className="form-title">Sign in to OpsEngine</h1>
            <p className="form-subtitle">
              Enter your organization credentials to access your workspace.
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
                <label className="form-label" htmlFor="domain">
                  Organization Domain
                </label>
                <div className="form-input-group">
                  <span className="material-symbols-outlined form-input-icon-left">
                    domain
                  </span>
                  <input
                    id="domain"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="acme.opsengine.enterprise"
                    required
                    disabled={loading}
                    className="input pl-9"
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="email">
                  Email Address
                </label>
                <div className="form-input-group">
                  <span className="material-symbols-outlined form-input-icon-left">
                    mail
                  </span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@acme.com"
                    required
                    disabled={loading}
                    className="input pl-9"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <div className="form-input-group">
                  <span className="material-symbols-outlined form-input-icon-left">
                    key
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    className="input pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="input-icon-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <span className="material-symbols-outlined icon-inline">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe((r) => !r)}
                  disabled={loading}
                  className="checkbox"
                />
                <label
                  htmlFor="remember-me"
                  className="text-xs font-mono text-on-surface font-medium cursor-pointer"
                >
                  Remember me on this computer
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-2"
                disabled={loading}
              >
                {loading ? (
                  "Authenticating..."
                ) : (
                  <>
                    Sign In
                    <span className="material-symbols-outlined icon-inline">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="relative mt-5 py-0.5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-outline-20" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-outline bg-card">
                Or
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline w-full mt-4"
            onClick={handleGoogleSSO}
            disabled={loading}
          >
            <span className="material-symbols-outlined icon-inline">
              id_token
            </span>
            Continue with Google / SSO
          </button>

          <div className="mt-5 space-y-2">
            <p className="text-xs font-mono text-outline">
              <span className="font-medium text-on-surface">Forgot password?</span>{" "}
              Reset via root recovery channel
            </p>
            <p className="text-xs font-mono text-outline">
              Need help?{" "}
              <span className="text-primary underline underline-offset-4 hover:text-primary-fixed cursor-pointer">
                Contact IT Support
              </span>
            </p>
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
