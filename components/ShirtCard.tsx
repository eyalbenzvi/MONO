"use client";

import { motion } from "framer-motion";
import { Compass, RotateCcw, Sparkles, Target } from "lucide-react";
import { PrintImage } from "@/components/PrintImage";
import { useShirtStore } from "@/store/useShirtStore";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  type RecommendationStrategy,
  type ShirtProduct,
  type ShirtSize,
} from "@/types/shirt";

const SIZES: ShirtSize[] = ["S", "M", "L", "XL"];

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
  const isBlack = shirt.baseColor === "black";
  const fabric = isBlack ? "fabric-black text-neutral-100" : "fabric-white text-neutral-900";
  const muted = isBlack ? "text-neutral-400" : "text-neutral-500";
  const { Icon, label } = STRATEGY_META[strategy];

  return (
    <div className="relative h-full w-full [perspective:1400px]">
      <motion.div
        className="preserve-3d relative h-full w-full"
        initial={false}
        animate={{ rotateY: isFlipped && isTop ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        {/* BACK OF SHIRT (card front face) */}
        <div
          className={`backface-hidden absolute inset-0 flex flex-col overflow-hidden rounded-[28px] shadow-2xl shadow-black/60 ring-1 ${
            isBlack ? "ring-white/10" : "ring-black/5"
          } ${fabric}`}
        >
          <div className="flex items-center justify-between px-4 pt-4">
            <MatchBadge score={score} dark={isBlack} />
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                isBlack ? "bg-white/10 text-neutral-300" : "bg-black/5 text-neutral-600"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </span>
          </div>

          {/* 3:4 rectangular back print, fit to available space */}
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-4 [container-type:size]">
            <div
              className="relative overflow-hidden rounded-[3px] shadow-[0_2px_20px_rgba(0,0,0,0.35)]"
              style={{ width: "min(100cqw, 75cqh)", aspectRatio: "3 / 4" }}
            >
              <PrintImage shirt={shirt} />
              <div className="pointer-events-none absolute inset-0 mix-blend-overlay [background:repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_3px)]" />
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 px-5 pb-5">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight">{shirt.title}</h2>
              <p className={`truncate text-xs ${muted}`}>
                {shirt.artist} · {isBlack ? "Black" : "White"} tee · back print
              </p>
            </div>
            <span className="shrink-0 font-mono text-lg font-semibold">${shirt.price}</span>
          </div>
        </div>

        {/* FRONT OF SHIRT + DETAILS (card back face) */}
        <div
          className={`backface-hidden rotate-y-180 absolute inset-0 overflow-hidden rounded-[28px] shadow-2xl shadow-black/60 ring-1 ${
            isBlack ? "ring-white/10" : "ring-black/5"
          } ${fabric}`}
        >
          {isTop && <CardDetails shirt={shirt} score={score} isBlack={isBlack} muted={muted} />}
        </div>
      </motion.div>
    </div>
  );
}

function MatchBadge({ score, dark }: { score: number; dark: boolean }) {
  return (
    <motion.span
      key={score}
      initial={{ scale: 0.9, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${
        dark ? "bg-white text-black" : "bg-black text-white"
      }`}
    >
      {score}% Match
    </motion.span>
  );
}

function CardDetails({
  shirt,
  score,
  isBlack,
  muted,
}: {
  shirt: ShirtProduct;
  score: number;
  isBlack: boolean;
  muted: string;
}) {
  const selected = useShirtStore((s) => s.selectedSizes[shirt.id]);
  const setSize = useShirtStore((s) => s.setSize);
  const toggleFlip = useShirtStore((s) => s.toggleFlip);
  const top = [...FEATURE_KEYS].sort((a, b) => shirt.features[b] - shirt.features[a]).slice(0, 5);
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div className="no-scrollbar flex h-full flex-col overflow-y-auto px-5 pb-5 pt-4">
      <div className="flex items-center justify-between">
        <MatchBadge score={score} dark={isBlack} />
        <button
          type="button"
          onPointerDown={stop}
          onClick={() => toggleFlip(false)}
          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
            isBlack ? "bg-white/10 hover:bg-white/15" : "bg-black/5 hover:bg-black/10"
          }`}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Back print
        </button>
      </div>

      <div className="relative mx-auto my-3 w-[62%] max-w-[220px] shrink-0">
        <TeeFront color={shirt.baseColor} />
        <div className="absolute left-[56%] top-[26%] aspect-square w-[16%] overflow-hidden rounded-[2px]">
          <PrintImage shirt={shirt} variant="front" />
        </div>
      </div>

      <h2 className="text-xl font-bold tracking-tight">{shirt.title}</h2>
      <p className={`text-xs ${muted}`}>{shirt.artist}</p>
      <p className={`mt-2 text-sm leading-snug ${isBlack ? "text-neutral-300" : "text-neutral-700"}`}>
        {shirt.description}
      </p>

      <div className="mt-4">
        <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${muted}`}>Size</p>
        <div className="grid grid-cols-4 gap-2">
          {SIZES.map((size) => {
            const active = selected === size;
            return (
              <button
                key={size}
                type="button"
                onPointerDown={stop}
                onClick={() => setSize(shirt.id, size)}
                aria-pressed={active}
                className={`h-11 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? isBlack
                      ? "bg-white text-black"
                      : "bg-black text-white"
                    : isBlack
                      ? "bg-white/5 ring-1 ring-white/15 hover:bg-white/10"
                      : "bg-black/[0.03] ring-1 ring-black/15 hover:bg-black/5"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${muted}`}>
          Print DNA
        </p>
        <ul className="space-y-1.5">
          {top.map((k) => (
            <li key={k} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0">{FEATURE_LABELS[k]}</span>
              <span className={`h-1.5 flex-1 overflow-hidden rounded-full ${isBlack ? "bg-white/10" : "bg-black/10"}`}>
                <span
                  className={`block h-full rounded-full ${isBlack ? "bg-white" : "bg-black"}`}
                  style={{ width: `${shirt.features[k] * 100}%` }}
                />
              </span>
              <span className={`w-8 text-right font-mono ${muted}`}>{shirt.features[k].toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={`mt-4 flex items-center justify-between border-t pt-3 text-sm ${isBlack ? "border-white/10" : "border-black/10"}`}>
        <span className={muted}>100% organic cotton · 220gsm</span>
        <span className="font-mono font-semibold">${shirt.price}</span>
      </div>
    </div>
  );
}

function TeeFront({ color }: { color: "black" | "white" }) {
  const fill = color === "black" ? "#161616" : "#fafaf8";
  const stroke = color === "black" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
  return (
    <svg viewBox="0 0 200 210" className="h-auto w-full drop-shadow-xl" aria-hidden>
      <path
        d="M62 12 L82 6 Q100 20 118 6 L138 12 L186 40 L168 78 L148 68 L148 202 L52 202 L52 68 L32 78 L14 40 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d="M82 6 Q100 26 118 6" fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
