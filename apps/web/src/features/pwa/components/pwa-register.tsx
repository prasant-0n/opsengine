"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Register Service Worker in production/supporting browsers
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check for worker updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New content is available
                }
              };
            }
          };
        })
        .catch((_err) => {
          // Service worker registration skipped in unsupported environments
        });

      // Capture PWA install prompt
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e as BeforeInstallPromptEvent);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setInstallPrompt(null);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  if (!installPrompt || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-16 md:bottom-6 right-4 z-50 flex items-center gap-3 bg-slate-900 border border-blue-500/30 text-white px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-fade-in">
      <div className="text-xs">
        <p className="font-semibold text-blue-400">Install OpsEngine App</p>
        <p className="text-slate-400">Install to home screen for offline access</p>
      </div>
      <button
        onClick={handleInstallClick}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow-md shadow-blue-600/30"
      >
        Install
      </button>
      <button
        onClick={() => setInstallPrompt(null)}
        className="text-slate-400 hover:text-white text-xs px-1"
        aria-label="Dismiss install prompt"
      >
        ✕
      </button>
    </div>
  );
}
