"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { AlgoDebugPanel } from "@/components/AlgoDebugPanel";
import { Header } from "@/components/Header";
import { LikedDrawer } from "@/components/LikedDrawer";
import { ShareSheet } from "@/components/ShareSheet";
import { Toast } from "@/components/Toast";
import { useShirtStore } from "@/store/useShirtStore";
import { useUiStore } from "@/store/useUiStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [savedOpen, setSavedOpen] = useState(false);
  const pathname = usePathname();

  // Leaving the shop area forgets where a product page was opened from.
  useEffect(() => {
    if (!/^\/shop(\/|$)/.test(pathname)) useUiStore.getState().setProductOrigin(null);
  }, [pathname]);

  // Another tab changed the saved session (a save, the bag…): reload it here
  // instead of overwriting it with this tab's stale copy on the next write.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === useShirtStore.persist.getOptions().name) useShirtStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Rehydrate from localStorage on the client only (avoids SSR mismatch),
  // then top the deck back up in case the dataset changed.
  useEffect(() => {
    const finish = () => {
      useShirtStore.getState().fillDeck();
      useShirtStore.getState().setHydrated();
    };
    const result = useShirtStore.persist.rehydrate();
    if (result instanceof Promise) result.then(finish);
    else finish();

    // Debug panel is opt-in: ?debug=1 (remembered for the tab) or 5 taps on the logo.
    try {
      const param = new URLSearchParams(window.location.search).get("debug");
      if (param === "1") useUiStore.getState().setDebug(true);
      else if (param === "0") useUiStore.getState().setDebug(false);
      else if (sessionStorage.getItem("mono-debug") === "1") useUiStore.setState({ debug: true });
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#161616_0%,#050505_60%)]">
      <Header onOpenSaved={() => setSavedOpen(true)} />
      <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
      <AlgoDebugPanel />
      <LikedDrawer open={savedOpen} onClose={() => setSavedOpen(false)} />
      <ShareSheet />
      <Toast />
    </div>
    </MotionConfig>
  );
}

export function useHydrated() {
  return useShirtStore((s) => s.hydrated);
}
