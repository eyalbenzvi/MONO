"use client";

import { useEffect, useState } from "react";
import { ActionButtons } from "@/components/ActionButtons";
import { AlgoDebugPanel } from "@/components/AlgoDebugPanel";
import { CardStack } from "@/components/CardStack";
import { Header } from "@/components/Header";
import { LikedDrawer } from "@/components/LikedDrawer";
import { useShirtStore } from "@/store/useShirtStore";

export default function Home() {
  const [likedOpen, setLikedOpen] = useState(false);
  const hydrated = useShirtStore((s) => s.hydrated);

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
  }, []);

  // Keyboard shortcuts for desktop testing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (likedOpen || e.target instanceof HTMLInputElement) return;
      const { requestSwipe, toggleFlip } = useShirtStore.getState();
      if (e.key === "ArrowRight") requestSwipe("like");
      else if (e.key === "ArrowLeft") requestSwipe("dislike");
      else if (e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        toggleFlip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [likedOpen]);

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#161616_0%,#050505_60%)]">
      <Header onOpenLiked={() => setLikedOpen(true)} />
      <section className="relative min-h-0 flex-1 px-4 pb-2 pt-3">
        {hydrated ? <CardStack /> : <CardSkeleton />}
      </section>
      <ActionButtons />
      <AlgoDebugPanel />
      <LikedDrawer open={likedOpen} onClose={() => setLikedOpen(false)} />
    </main>
  );
}

function CardSkeleton() {
  return (
    <div className="relative mx-auto h-full w-full max-w-[420px]">
      <div className="absolute inset-0 animate-pulse rounded-[28px] bg-white/[0.04] ring-1 ring-white/10" />
    </div>
  );
}
