"use client";

import { useState } from "react";
import type { ShirtProduct } from "@/types/shirt";

/**
 * Monochrome print image. Forces grayscale regardless of the source photo and
 * falls back to a generative SVG print (derived from the feature vector) if
 * the remote image can't load, so a card never renders broken.
 */
export function PrintImage({
  shirt,
  variant = "back",
  className = "",
}: {
  shirt: ShirtProduct;
  variant?: "back" | "front";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = variant === "back" ? shirt.backImageUrl : shirt.frontImageUrl;

  if (failed) return <GenerativePrint shirt={shirt} className={className} />;

  return (
    <img
      src={src}
      alt={`${shirt.title} print`}
      draggable={false}
      onError={() => setFailed(true)}
      className={`h-full w-full select-none object-cover grayscale contrast-125 ${className}`}
    />
  );
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function GenerativePrint({ shirt, className }: { shirt: ShirtProduct; className: string }) {
  const f = shirt.features;
  const rnd = hash(shirt.id);
  const ink = "#f5f5f5";
  const bg = "#0a0a0a";
  const els: JSX.Element[] = [];

  if (f.halftone_raster > 0.5) {
    const step = 6 + Math.round((1 - f.density) * 6);
    for (let y = 0; y < 400; y += step)
      for (let x = 0; x < 300; x += step) {
        const r = (step / 2) * Math.abs(Math.sin((x + y) / 60 + rnd() * 0.4));
        els.push(<circle key={`h${x}-${y}`} cx={x} cy={y} r={r} fill={ink} />);
      }
  }
  if (f.line_art > 0.5) {
    const n = 10 + Math.round(f.density * 20);
    for (let i = 0; i < n; i++) {
      const y = (i / n) * 400;
      els.push(
        <path
          key={`l${i}`}
          d={`M0 ${y} Q 150 ${y + (rnd() - 0.5) * 120} 300 ${y}`}
          stroke={ink}
          strokeWidth={1.2}
          fill="none"
        />,
      );
    }
  }
  if (f.geometric > 0.5 || f.architectural > 0.5) {
    const n = 4 + Math.round(f.density * 8);
    for (let i = 0; i < n; i++) {
      els.push(
        <rect
          key={`g${i}`}
          x={rnd() * 240}
          y={rnd() * 340}
          width={20 + rnd() * 100}
          height={20 + rnd() * 140}
          fill={rnd() > 0.5 ? ink : "none"}
          stroke={ink}
          strokeWidth={2}
        />,
      );
    }
  }
  if (f.abstract > 0.6) {
    els.push(<circle key="a" cx={150} cy={200} r={60 + f.contrast * 60} fill={ink} opacity={0.85} />);
  }
  if (f.typography > 0.5) {
    els.push(
      <text key="t" x={150} y={215} textAnchor="middle" fontSize={54} fontWeight={900} fill={ink} fontFamily="Helvetica, Arial, sans-serif" letterSpacing={-2}>
        {shirt.title.split(" ")[0].toUpperCase()}
      </text>,
    );
  }
  if (els.length === 0) {
    // Quiet / minimal prints: a soft tonal gradient with a single hairline.
    els.push(
      <g key="m">
        <defs>
          <linearGradient id={`g-${shirt.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={ink} stopOpacity={0.9} />
            <stop offset="1" stopColor={ink} stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect width={300} height={400} fill={`url(#g-${shirt.id})`} />
        <line x1={40} y1={330} x2={260} y2={330} stroke={ink} strokeWidth={1} />
      </g>,
    );
  }

  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className={`h-full w-full ${className}`}>
      <rect width={300} height={400} fill={bg} />
      {els}
    </svg>
  );
}
