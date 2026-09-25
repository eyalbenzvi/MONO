"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TeeMockup } from "@/components/TeeMockup";
import { TeeDot } from "@/components/ShirtCard";
import { MatchBadge, SaveButton, STAGE_BG, useShowMatch } from "@/components/ui";
import { useShirtStore } from "@/store/useShirtStore";
import { CATEGORY_LABELS, COLOR_LABELS, type BaseColor, type ShirtProduct } from "@/types/shirt";

/** Below this the % adds noise, not information. */
const SHOW_BADGE_FROM = 80;

export function ProductCard({
  shirt,
  score,
  topPick = false,
  color,
  onOpen,
  variations = 0,
}: {
  shirt: ShirtProduct;
  score: number;
  topPick?: boolean;
  /** Other designs in this card's family (shown as "+N variations"). */
  variations?: number;
  /** Render in this tee colour (and open the product in it); default = original. */
  color?: BaseColor;
  onOpen?: () => void;
}) {
  const setColor = useShirtStore((s) => s.setColor);
  const showMatch = useShowMatch();
  const tee = color ?? shirt.baseColor;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Link
        href={`/shop/${shirt.id}/`}
        onClick={() => {
          if (color) setColor(shirt.id, color);
          onOpen?.();
        }}
        className="group block rounded-2xl"
        aria-label={`${shirt.title}, $${shirt.price}${showMatch ? `, ${score}% match` : ""}${variations ? `, ${variations} variations` : ""}`}
      >
        <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ring-1 ring-white/10 ${STAGE_BG}`}>
          {showMatch && (topPick || score >= SHOW_BADGE_FROM) && (
            <div className="absolute left-2 top-2">
              <MatchBadge score={score} size="sm" variant={topPick ? "top" : "quiet"} />
            </div>
          )}
          <SaveButton id={shirt.id} className="absolute right-2 top-2 h-8 w-8" />
          {variations > 0 && (
            <span className="absolute bottom-2 left-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm">
              +{variations} variation{variations === 1 ? "" : "s"}
            </span>
          )}
          <TeeMockup shirt={shirt} color={tee} className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        </div>
        <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{shirt.title}</p>
            <p className="truncate text-xs text-neutral-400">
              <TeeDot color={tee} /> {COLOR_LABELS[tee]} · {CATEGORY_LABELS[shirt.category]}
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm">${shirt.price}</span>
        </div>
      </Link>
    </motion.div>
  );
}
