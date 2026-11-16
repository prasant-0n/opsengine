"use client";

import * as React from "react";
import { useAssistant } from "./assistant-context";
import {
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SUGGESTED_PROMPTS = [
  "How many active employees are in our organization?",
  "List unpaid invoices and upcoming due dates.",
  "What is the status of active delivery projects?",
  "Explain our approval and Separation of Duties rules.",
];

export function AssistantConversationView({
  compact = false,
  onPromptClick,
}: {
  compact?: boolean;
  onPromptClick?: () => void;
}) {
  const {
    messages,
    input,
    setInput,
    loading,
    error,
    enabled,
    canUse,
    send,
    clearConversation,
  } = useAssistant();

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (enabled === null) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Checking AI workspace entitlement…</p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 mb-3 inline-flex">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">AI Module Disabled</h3>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          AI assistant features are currently inactive for this organization workspace. Please contact your system administrator to activate AI capabilities.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-between overflow-hidden">
      {/* Top Banner if error */}
      {error && (
        <div className="mx-3 mt-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span className="truncate">{error}</span>
          <button
            type="button"
            onClick={() => send()}
            className="text-[11px] underline ml-2 font-medium shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6 sm:py-10 px-2">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-cyan-500/15 to-transparent border border-indigo-500/30 text-cyan-400 mb-4 shadow-lg shadow-indigo-500/5">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
              OpsEngine AI Assistant
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
              Ask questions about employees, invoices, project portfolio status, and system policies.
            </p>

            <div className="w-full mt-6 space-y-2 text-left">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/80 block px-1">
                Suggested questions:
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      send(prompt);
                      onPromptClick?.();
                    }}
                    disabled={loading || !canUse}
                    className="p-2.5 rounded-lg text-xs text-left bg-secondary/50 hover:bg-secondary/90 hover:border-border border border-border/40 text-foreground transition-all duration-150 leading-snug group flex items-start justify-between gap-2"
                  >
                    <span>{prompt}</span>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2.5 items-start ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground font-medium rounded-tr-sm shadow-sm"
                    : m.isError
                    ? "bg-destructive/15 border border-destructive/30 text-rose-300 rounded-tl-sm"
                    : "bg-secondary/70 border border-border/70 text-foreground rounded-tl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap select-text">{m.text}</p>

                {m.role === "assistant" && !m.isError && (
                  <div className="mt-1 pt-1 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>OpsEngine AI · Gemini</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(m.text, m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-foreground flex items-center gap-1"
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-2.5 items-start justify-start">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-secondary/70 border border-border/70 text-foreground rounded-xl rounded-tl-sm px-3.5 py-2.5 text-xs flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span className="text-muted-foreground">Thinking and querying workspace context…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="p-3 border-t border-border/60 bg-secondary/20">
        <div className="relative flex items-end gap-2 bg-card rounded-xl border border-border/80 focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/20 transition-all p-1.5">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || !canUse}
            placeholder={
              !canUse
                ? "Permission required: assistant.use"
                : "Ask OpsEngine AI... (Enter to send)"
            }
            className="w-full resize-none bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 outline-none border-none max-h-24 overflow-y-auto no-scrollbar disabled:cursor-not-allowed"
          />

          <button
            type="button"
            onClick={() => send()}
            disabled={loading || !input.trim() || !canUse}
            className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            aria-label="Send message"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Controlled ReBAC Engine
          </span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Clear chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
