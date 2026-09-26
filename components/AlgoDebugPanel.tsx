"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { AnimatePresence, motion } from "framer-motion";
import { getShirtById } from "@/lib/catalog";
import {
  centeredCosine,
  cosineSimilarity,
  matchScore,
  similarityBreakdown,
} from "@/lib/recommendation";
import { CALIBRATION_IDS, CALIBRATION_TOTAL, calibrationDone } from "@/lib/deck";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { FEATURE_KEYS, FEATURE_LABELS } from "@/types/shirt";

export function AlgoDebugPanel() {
  const hydrated = useUiStore((s) => s.hydrated);
  // Developer tool: hidden unless ?debug=1 or the logo was tapped 5 times.
  // Returns before subscribing to taste state or computing anything.
  const debug = useUiStore((s) => s.debug);
  if (!hydrated || !debug) return null;
  return <DebugPanel />;
}

function DebugPanel() {
  const [open, setOpen] = useState(false);
  const seen = useTasteStore((s) => s.seen);
  const vector = useTasteStore((s) => s.preferenceVector);
  const deck = useTasteStore((s) => s.deck);
  const history = useTasteStore((s) => s.swipeHistory);
  const likes = useTasteStore((s) => s.likedIds.length);
  const lastUpdate = useTasteStore((s) => s.lastUpdate);
  const reset = useTasteStore((s) => s.reset);

  const top = deck[0];
  const shirt = top ? getShirtById(top.id) : undefined;
  const breakdown = shirt ? similarityBreakdown(vector, shirt.features) : [];
  const postCal = history.slice(CALIBRATION_TOTAL);
  const exploreRate = postCal.length
    ? Math.round((postCal.filter((h) => h.strategy === "explore").length / postCal.length) * 100)
    : 0;

  return (
    <div className="pointer-events-none fixed left-3 top-[calc(max(env(safe-area-inset-top),10px)+60px)] z-30 flex flex-col-reverse items-start sm:left-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="no-scrollbar pointer-events-auto mt-2 max-h-[62dvh] w-[min(92vw,340px)] origin-top-left overflow-y-auto rounded-2xl border border-white/10 bg-ink-900/95 p-4 font-mono text-[11px] text-neutral-300 shadow-2xl shadow-black backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">Algo debug</span>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-400 ring-1 ring-white/10 hover:bg-white/5 hover:text-white"
              >
                <Icon name="rotate-ccw" className="h-3 w-3" /> Reset
              </button>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-1.5 text-center">
              <Stat label="Seen" value={seen.length} />
              <Stat label="Likes" value={likes} />
              <Stat label="Calib" value={`${calibrationDone(CALIBRATION_IDS, seen)}/${CALIBRATION_TOTAL}`} />
              <Stat label="Explore" value={`${exploreRate}%`} />
            </div>

            <Section title="User vector">
              {lastUpdate && (
                <p className="mb-1.5 text-[10px] text-neutral-500">
                  Δ from last {lastUpdate.action === "like" ? "♥ like" : "✕ dislike"} ·{" "}
                  {getShirtById(lastUpdate.shirtId)?.title}
                </p>
              )}
              <ul className="space-y-1">
                {FEATURE_KEYS.map((k) => {
                  const v = vector[k];
                  const delta = lastUpdate ? lastUpdate.after[k] - lastUpdate.before[k] : 0;
                  return (
                    <li key={k} className="flex items-center gap-2">
                      <span className="w-[74px] shrink-0 truncate text-neutral-400">{FEATURE_LABELS[k]}</span>
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <span className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
                        <motion.span
                          className="block h-full rounded-full bg-white"
                          initial={false}
                          animate={{ width: `${v * 100}%` }}
                          transition={{ type: "spring", stiffness: 200, damping: 26 }}
                        />
                      </span>
                      <span className="w-9 text-right text-white">{v.toFixed(3)}</span>
                      <span
                        className={`w-11 text-right ${
                          delta > 0.0005 ? "font-semibold text-white" : delta < -0.0005 ? "text-neutral-400" : "text-neutral-600"
                        }`}
                      >
                        {delta >= 0 ? "+" : ""}
                        {delta.toFixed(3)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>

            {shirt && top && (
              <Section title={`Discover top card · ${shirt.title}`}>
                <div className="mb-2 grid grid-cols-3 gap-1.5 text-center">
                  <Stat label="Cosine" value={`${cosineSimilarity(vector, shirt.features).toFixed(1)}%`} />
                  <Stat label="Centered" value={centeredCosine(vector, shirt.features).toFixed(3)} />
                  <Stat label="Match" value={`${matchScore(vector, shirt.features)}%`} />
                </div>
                <p className="mb-1.5 text-[10px] text-neutral-500">
                  Strategy: <span className="text-white">{top.strategy}</span> · dot-product share per feature
                </p>
                <ul className="space-y-1">
                  {[...breakdown]
                    .sort((a, b) => b.product - a.product)
                    .map((row) => (
                      <li key={row.key} className="flex items-center gap-2">
                        <span className="w-[74px] shrink-0 truncate text-neutral-400">{FEATURE_LABELS[row.key]}</span>
                        <span className="w-[86px] shrink-0 text-neutral-500">
                          {row.user.toFixed(2)}×{row.shirt.toFixed(2)}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full bg-white/80" style={{ width: `${row.share * 100 * 3}%` }} />
                        </span>
                        <span className="w-9 text-right">{(row.share * 100).toFixed(0)}%</span>
                      </li>
                    ))}
                </ul>
              </Section>
            )}

            {history.length > 0 && (
              <Section title="Recent swipes">
                <ul className="space-y-0.5">
                  {history
                    .slice(-6)
                    .reverse()
                    .map((h) => (
                      <li key={h.timestamp + h.shirtId} className="flex justify-between gap-2">
                        <span className={h.action === "like" ? "font-semibold text-white" : "text-neutral-400"}>
                          {h.action === "like" ? "♥" : "✕"}
                        </span>
                        {h.source === "shop" && <span className="text-neutral-500">shop</span>}
                        <span className="flex-1 truncate">{getShirtById(h.shirtId)?.title}</span>
                        <span className="text-neutral-500">{h.strategy.slice(0, 5)}</span>
                        <span className="w-9 text-right">{h.matchScore}%</span>
                      </li>
                    ))}
                </ul>
              </Section>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Toggle algorithm debug panel"
        title="Algorithm debug"
        className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 shadow-lg shadow-black/60 backdrop-blur-md transition active:scale-90 ${
          open ? "bg-white text-black" : "bg-ink-850/90 text-neutral-300 hover:text-white"
        }`}
      >
        {open ? <Icon name="chevron-down" className="h-4 w-4" /> : <Icon name="activity" className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-1 py-1.5 ring-1 ring-white/5">
      <div className="text-[12px] font-semibold text-white">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="mb-2 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">{title}</p>
      {children}
    </div>
  );
}
