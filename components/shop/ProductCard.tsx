"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TeeMockup } from "@/components/TeeMockup";
import { TeeDot } from "@/components/ShirtCard";
import { MatchBadge, SaveButton, STAGE_BG } from "@/components/ui";
import type { ShirtProduct } from "@/types/shirt";

export function ProductCard({ shirt, score, highlight }: { shirt: ShirtProduct; score: number; highlight?: string }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <Link href={`/shop/${shirt.id}/`} className="group block" aria-label={`${shirt.title}, $${shirt.price}, ${score}% match`}>
        <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ring-1 ring-white/10 ${STAGE_BG}`}>
          <div className="absolute left-2 top-2">
            <MatchBadge score={score} size="sm" />
          </div>
          {highlight && (
            <span className="absolute bottom-2 left-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              {highlight}
            </span>
          )}
          <SaveButton id={shirt.id} className="absolute right-2 top-2 h-8 w-8" />
          <TeeMockup shirt={shirt} className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        </div>
        <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{shirt.title}</p>
            <p className="truncate text-[11px] text-neutral-500">
              <TeeDot color={shirt.baseColor} /> {shirt.baseColor === "black" ? "Black" : "White"} · {shirt.artist}
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm">${shirt.price}</span>
        </div>
      </Link>
    </motion.div>
  );
}
