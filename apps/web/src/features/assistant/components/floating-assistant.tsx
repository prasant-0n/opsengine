"use client";

import * as React from "react";
import { useAssistant } from "./assistant-context";
import { AssistantConversationView } from "./assistant-conversation-view";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { MagneticTooltip } from "@/components/ui/magnetic-tooltip";
import {
  Sparkles,
  Bot,
  X,
  Minimize2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function FloatingAssistant() {
  const {
    drawerState,
    openDrawer,
    closeDrawer,
    minimizeDrawer,
    canUse,
    enabled,
    messages,
  } = useAssistant();

  const drawerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Close drawer on Escape
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && drawerState === "open") {
        minimizeDrawer();
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerState, minimizeDrawer]);

  // If user does not have permission or AI is explicitly disabled, do not render launcher
  if (!canUse || enabled === false) {
    return null;
  }

  const hasUnreadOrActive = messages.length > 0;

  return (
    <>
      {/* =========================================================================
          State A: Floating Launcher Button (Aceternity / Animate UI Shimmer Standard)
          Visible ONLY when drawer is 'closed'
          ========================================================================= */}
      <AnimatePresence>
        {drawerState === "closed" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <MagneticTooltip content="Open AI Assistant">
              <ShimmerButton
                ref={triggerRef}
                onClick={openDrawer}
                shimmerColor="#22D3EE"
                shimmerSize="0.1em"
                shimmerDuration="3.5s"
                borderRadius="24px"
                className="w-14 h-14 !p-0 shadow-2xl shadow-indigo-950/60"
                aria-label="Open AI Assistant"
              >
                <div className="relative flex items-center justify-center">
                  <Bot className="w-6 h-6 text-[#22D3EE] transition-transform duration-200 group-hover:scale-110" />
                  <Sparkles className="w-3 h-3 text-[#6366F1] absolute -top-1 -right-1" />
                </div>

                {/* Micro ping badge when conversation is active */}
                {hasUnreadOrActive && (
                  <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22D3EE] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22D3EE]" />
                  </span>
                )}
              </ShimmerButton>
            </MagneticTooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          State C: Minimized Right-Edge Tab (Aceternity Spring Slider)
          Visible ONLY when drawer is 'minimized'
          ========================================================================= */}
      <AnimatePresence>
        {drawerState === "minimized" && (
          <motion.div
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40"
          >
            <MagneticTooltip content="Reopen AI Assistant">
              <button
                type="button"
                onClick={openDrawer}
                aria-label="Reopen AI Assistant"
                className="flex items-center gap-1.5 py-3.5 px-2 rounded-l-2xl bg-[#171B27]/95 hover:bg-[#1D222C] text-[#F3F4F6] border-y border-l border-[#303744] hover:border-[#22D3EE]/60 shadow-2xl shadow-black/60 backdrop-blur-md transition-all duration-200 hover:-translate-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
              >
                <Bot className="w-4 h-4 text-[#22D3EE]" />
                <span className="text-xs font-semibold tracking-wide text-[#F3F4F6] [writing-mode:vertical-lr] rotate-180 py-1 font-mono">
                  OpsEngine AI
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] rotate-180" />

                {hasUnreadOrActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] self-center mt-1" />
                )}
              </button>
            </MagneticTooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          State B: Right-Side AI Assistant Drawer (Framer-Motion Glass Drawer)
          Visible ONLY when drawer is 'open'
          ========================================================================= */}
      <AnimatePresence>
        {drawerState === "open" && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={minimizeDrawer}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden"
              aria-hidden="true"
            />

            <motion.aside
              ref={drawerRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              role="dialog"
              aria-label="OpsEngine AI Assistant"
              className="fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] max-w-full z-50 bg-[#171B27]/95 backdrop-blur-xl border-l border-[#303744] shadow-2xl shadow-black/80 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-[#303744]/80 bg-[#111318]/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#22D3EE] flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm text-[#F3F4F6] tracking-tight">
                        OpsEngine AI
                      </h3>
                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <p className="text-[10px] font-mono text-[#94A3B8]">
                      Controlled Workspace Intelligence
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={minimizeDrawer}
                    className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F3F4F6] hover:bg-[#1D222C] transition-colors"
                    aria-label="Minimize AI Assistant"
                    title="Minimize to right tab"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F3F4F6] hover:bg-[#1D222C] transition-colors"
                    aria-label="Close AI Assistant"
                    title="Close AI Assistant"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </header>

              {/* Conversation Content */}
              <div className="flex-1 overflow-hidden">
                <AssistantConversationView compact />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
