"use client";

import * as React from "react";
import { useShell } from "@/components/layout/shell-context";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt?: string;
  isError?: boolean;
}

interface AssistantContextType {
  messages: ChatMessage[];
  input: string;
  setInput: (val: string) => void;
  loading: boolean;
  error: string | null;
  enabled: boolean | null;
  canUse: boolean;
  send: (customPrompt?: string) => Promise<void>;
  clearConversation: () => void;
  drawerState: "closed" | "open" | "minimized";
  openDrawer: () => void;
  closeDrawer: () => void;
  minimizeDrawer: () => void;
}

const AssistantContext = React.createContext<AssistantContextType | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const { can } = useShell();
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [drawerState, setDrawerState] = React.useState<"closed" | "open" | "minimized">("closed");

  const canUse = can("assistant.use");

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/assistant/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { aiEnabled: false }))
      .then((d) => {
        if (!cancelled) setEnabled(!!d.aiEnabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = React.useCallback(
    async (customPrompt?: string) => {
      const promptToSend = (customPrompt ?? input).trim();
      if (!promptToSend || loading || !canUse) return;

      if (!customPrompt) {
        setInput("");
      }

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: promptToSend,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptToSend }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMessage = data.error ?? `Failed (${res.status})`;
          setError(errMessage);
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              text: `Error: ${errMessage}`,
              createdAt: new Date().toISOString(),
              isError: true,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: data.response ?? "No response generated.",
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch (err: any) {
        const errMessage = err.message ?? "Network error";
        setError(errMessage);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            text: `Network failure: ${errMessage}`,
            createdAt: new Date().toISOString(),
            isError: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, canUse]
  );

  const clearConversation = React.useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const openDrawer = React.useCallback(() => setDrawerState("open"), []);
  const closeDrawer = React.useCallback(() => setDrawerState("closed"), []);
  const minimizeDrawer = React.useCallback(() => setDrawerState("minimized"), []);

  const value = React.useMemo(
    () => ({
      messages,
      input,
      setInput,
      loading,
      error,
      enabled,
      canUse,
      send,
      clearConversation,
      drawerState,
      openDrawer,
      closeDrawer,
      minimizeDrawer,
    }),
    [
      messages,
      input,
      loading,
      error,
      enabled,
      canUse,
      send,
      clearConversation,
      drawerState,
      openDrawer,
      closeDrawer,
      minimizeDrawer,
    ]
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = React.useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistant must be used within an AssistantProvider");
  }
  return context;
}
