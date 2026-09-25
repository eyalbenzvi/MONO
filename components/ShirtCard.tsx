"use client";

import { motion } from "framer-motion";
import { Compass, RotateCcw, ShoppingBag, Sparkles, Target } from "lucide-react";
import { TeeMockup } from "@/components/TeeMockup";
import { MatchBadge, SizeSelector, STAGE_BG } from "@/components/ui";
import { useShirtStore } from "@/store/useShirtStore";
import {
  CATEGORY_LABELS,
  FEATURE_KEYS,
  FEATURE_LABELS,
  PRINT_SIZE_CM,
  type RecommendationStrategy,
  type ShirtProduct,
} from "@/types/shirt";

const STRATEGY_META: Record<RecommendationStrategy, { label: string; Icon: typeof Target }> = {
  calibration: { label: "Calibrating", Icon: Sparkles },
  greedy: { label: "For you", Icon: Target },
  explore: { label: "Explore", Icon: Compass },
};

interface ShirtCardProps {
  shirt: ShirtProduct;
  strategy: RecommendationStrategy;
  score: number;
  isFlipped: boolean;
  isTop: boolean;
}

export function ShirtCard({ shirt, strategy, score, isFlipped, isTop }: ShirtCardProps) {
  const { Icon, label } = STRATEGY_META[strategy];
  const showDetails = isFlipped && isTop;
  // backface-visibility hides a face visually but not from hit-testing, so the
  // face turned away must also stop taking pointer events.
  const hiddenFace = "pointer-events-none";

  return (
    <div className="relative h-full w-full [perspective:1400px]">
      <motion.div
        className="preserve-3d relative h-full w-full"
        initial={false}
        animate={{ rotateY: showDetails ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        {/* Face 1: the tee, print mocked up on the fabric */}
        <div
          className={`backface-hidden absolute inset-0 flex flex-col overflow-hidden rounded-[28px] bg-ink-900 shadow-2xl shadow-black/70 ring-1 ring-white/10 ${showDetails ? hiddenFace : ""}`}
          aria-hidden={showDetails}
        >
          <div className={`relative flex min-h-0 flex-1 flex-col ${STAGE_BG}`}>
            <div className="flex items-center justify-between px-4 pt-4">
              <MatchBadge score={score} />
              <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-200 backdrop-blur-sm">
                <Icon className="h-3 w-3" />
                {label}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-2 pt-1 [container-type:size]">
              <TeeMockup shirt={shirt} style={{ width: "min(100cqw, calc(100cqh * 340 / 440))" }} />
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 px-5 pb-4 pt-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight">{shirt.title}</h2>
              <p className="truncate text-xs text-neutral-400">
                {CATEGORY_LABELS[shirt.category]} · <TeeDot color={shirt.baseColor} /> {shirt.baseColor === "black" ? "Black" : "White"} tee
              </p>
            </div>
            <span className="shrink-0 font-mono text-lg font-semibold">${shirt.price}</span>
          </div>
        </div>

        {/* Face 2: product details */}
        <div
          className={`backface-hidden rotate-y-180 absolute inset-0 overflow-hidden rounded-[28px] bg-ink-900 shadow-2xl shadow-black/70 ring-1 ring-white/10 ${showDetails ? "" : hiddenFace}`}
          aria-hidden={!showDetails}
        >
          {isTop && <CardDetails shirt={shirt} score={score} />}
        </div>
      </motion.div>
    </div>
  );
}

export function TeeDot({ color }: { color: "black" | "white" }) {
  return (
    <span
      className={`inline-block h-2 w-2 translate-y-[-1px] rounded-full ring-1 ${
        color === "black" ? "bg-black ring-white/40" : "bg-white ring-white/40"
      }`}
    />
  );
}

function CardDetails({ shirt, score }: { shirt: ShirtProduct; score: number }) {
  const selected = useShirtStore((s) => s.selectedSizes[shirt.id]);
  const setSize = useShirtStore((s) => s.setSize);
  const toggleFlip = useShirtStore((s) => s.toggleFlip);
  const addToCart = useShirtStore((s) => s.addToCart);
  const top = [...FEATURE_KEYS].sort((a, b) => shirt.features[b] - shirt.features[a]).slice(0, 5);
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const black = shirt.baseColor === "black";

  return (
    <div className="no-scrollbar flex h-full flex-col overflow-y-auto px-5 pb-5 pt-4">
      <div className="flex items-center justify-between">
        <MatchBadge score={score} />
        <button
          type="button"
          onPointerDown={stop}
          onClick={() => toggleFlip(false)}
          className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-medium hover:bg-white/15"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Tee view
        </button>
      </div>

      <div className="mt-3 flex gap-4">
        <div className={`w-28 shrink-0 rounded-2xl p-2 ${STAGE_BG}`}>
          <TeeMockup shirt={shirt} shadow={false} className="w-full" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight tracking-tight">{shirt.title}</h2>
          <p className="text-xs text-neutral-400">{CATEGORY_LABELS[shirt.category]} · {shirt.sku}</p>
          <p className="mt-2 text-sm leading-snug text-neutral-300">{shirt.description}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Spec label="Tee" value={black ? "Black" : "White"} />
        <Spec label="Ink" value={black ? "White, 1 colour" : "Black, 1 colour"} />
        <Spec label="Print" value={`${PRINT_SIZE_CM.width}×${PRINT_SIZE_CM.height} cm`} />
        <Spec label="Style" value={CATEGORY_LABELS[shirt.category]} />
      </dl>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Size</p>
        <SizeSelector value={selected} onChange={(s) => setSize(shirt.id, s)} stopPointer />
      </div>

      <button
        type="button"
        disabled={!selected}
        onPointerDown={stop}
        onClick={() => selected && addToCart(shirt.id, selected)}
        className="mt-3 flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition active:scale-[0.98] disabled:bg-white/10 disabled:text-neutral-500"
      >
        <ShoppingBag className="h-4 w-4" />
        {selected ? `Add to bag · $${shirt.price}` : "Select a size"}
      </button>

      <div className="mt-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Print DNA</p>
        <ul className="space-y-1.5">
          {top.map((k) => (
            <li key={k} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0">{FEATURE_LABELS[k]}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-white" style={{ width: `${shirt.features[k] * 100}%` }} />
              </span>
              <span className="w-8 text-right font-mono text-neutral-500">{shirt.features[k].toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/5">
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-neutral-200">{value}</dd>
    </div>
  );
}
