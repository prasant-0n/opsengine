"use client";

import { useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";

export default function AssistantPage() {
  const { can } = useShell();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUse = can("assistant.use");

  useEffect(() => {
    fetch("/api/assistant/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { aiEnabled: false }))
      .then((d) => setEnabled(!!d.aiEnabled))
      .catch(() => setEnabled(false));
  }, []);

  async function send() {
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${data.error ?? "Failed to query assistant"}` }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", text: data.response }]);
    } catch (err: any) {
      setError(err.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  if (enabled === null) {
    return <div className="page-stack"><div className="state-panel state-panel-empty">Checking AI entitlement…</div></div>;
  }

  if (!enabled) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <div>
            <h1>AI Assistant</h1>
            <p className="muted">Controlled enterprise AI interface</p>
          </div>
        </header>
        <div className="state-panel state-panel-error">
          AI features are not enabled for this organization. Please contact your platform operator to activate this premium feature for your workspace membership.
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>AI Assistant</h1>
          <p className="muted mono">assistant.use · Powered by Gemini</p>
        </div>
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <div className="panel" style={{ minHeight: "350px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem", maxHeight: "500px", overflowY: "auto", padding: "0.5rem" }}>
          {messages.length === 0 ? (
            <div className="state-panel state-panel-empty">Ask the assistant anything about your organization, projects, or invoices.</div>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} style={{ padding: "0.75rem", borderRadius: "8px", background: m.role === "user" ? "#1e293b" : "#0f172a", border: "1px solid #334155" }}>
                <strong className="mono" style={{ fontSize: "0.8rem", color: m.role === "user" ? "#818cf8" : "#38bdf8" }}>
                  {m.role === "user" ? "You" : "OpsEngine AI"}
                </strong>
                <p style={{ marginTop: "0.25rem", whiteSpace: "pre-wrap" }}>{m.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="inline-form" style={{ borderTop: "1px solid #334155", paddingTop: "1rem" }}>
          <input
            className="input"
            placeholder="Type a message or request..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={loading || !canUse}
          />
          <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim() || !canUse}>
            {loading ? "Thinking…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
