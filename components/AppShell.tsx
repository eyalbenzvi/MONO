"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { AlgoDebugPanel } from "@/components/AlgoDebugPanel";
import { Header } from "@/components/Header";
import { LikedDrawer } from "@/components/LikedDrawer";
import { ShareSheet } from "@/components/ShareSheet";
import { Toast } from "@/components/Toast";
import { useCartStore } from "@/store/cartStore";
import { migrateLegacySession } from "@/store/legacySession";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { decodeTaste } from "@/lib/taste";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [savedOpen, setSavedOpen] = useState(false);
  const pathname = usePathname();

  // Leaving the shop area forgets where a product page was opened from;
  // any navigation closes the zoom view.
  useEffect(() => {
    useUiStore.getState().setZoom(null);
    if (!/^\/shop(\/|$)/.test(pathname)) useUiStore.getState().setProductOrigin(null);
  }, [pathname]);

  // Another tab changed the saved session (a save, the bag…): reload it here
  // instead of overwriting it with this tab's stale copy on the next write.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      for (const store of [useTasteStore, useCartStore])
        if (e.key === store.persist.getOptions().name) void store.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Rehydrate from localStorage on the client only (avoids SSR mismatch):
  // first move an old single-store session into the split stores, then load
  // both, then top the deck back up in case the dataset changed.
  useEffect(() => {
    migrateLegacySession();
    void Promise.all([useTasteStore.persist.rehydrate(), useCartStore.persist.rehydrate()]).then(() => {
      useTasteStore.getState().fillDeck();
      useUiStore.getState().setHydrated();
    });

    // A friend's taste link (/?taste=…): kept for this session so the taste
    // test can end with "Compare with a friend"; removed from the address bar.
    try {
      const q = new URLSearchParams(window.location.search);
      const code = q.get("taste") ?? sessionStorage.getItem("mono-friend-taste");
      const friend = decodeTaste(code);
      if (friend && code) {
        sessionStorage.setItem("mono-friend-taste", code);
        useUiStore.setState({ friendTaste: friend });
      }
      if (q.has("taste")) {
        q.delete("taste");
        const rest = q.toString();
        window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
      }
    } catch {
      /* storage unavailable */
    }

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

export { useHydrated } from "@/store/useUiStore";
