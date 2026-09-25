"use client";

import { useId } from "react";
import { PrintImage } from "@/components/PrintImage";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

/*
 * Garment geometry lives in a 400×460 design space; the viewBox crops the
 * empty margins. The 3:4 print rectangle sits centred in the upper body.
 */
const VIEW = { x: 30, y: 10, w: 340, h: 440 };
const PRINT = { x: 132, y: 78, w: 136, h: (136 * 4) / 3 };

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const PRINT_STYLE = {
  left: pct(PRINT.x - VIEW.x, VIEW.w),
  top: pct(PRINT.y - VIEW.y, VIEW.h),
  width: pct(PRINT.w, VIEW.w),
  height: pct(PRINT.h, VIEW.h),
};

const BODY =
  "M150 24 Q200 36 250 24 L302 38 Q338 52 378 118 L336 164 L306 146 L308 432 Q200 442 92 432 L94 146 L64 164 L22 118 Q62 52 98 38 Z";

interface TeeMockupProps {
  shirt: ShirtProduct;
  /** Tee colour to render; defaults to the design's original colourway. */
  color?: BaseColor;
  className?: string;
  /** Drop shadow under the garment (off for tiny thumbnails). */
  shadow?: boolean;
  style?: React.CSSProperties;
}

export function TeeMockup({ shirt, color = shirt.baseColor, className = "", shadow = true, style }: TeeMockupProps) {
  const uid = useId().replace(/:/g, "");
  const black = color === "black";
  const fabric = black ? "#161616" : "#f3f3f1";
  const seam = black ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.12)";
  const collar = black ? "#0d0d0d" : "#e6e6e3";
  const body = BODY;
  const viewBox = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;
  const clip = `clip-${uid}`;

  return (
    <div
      className={`relative isolate select-none ${className}`}
      style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}`, ...style }}
      role="img"
      aria-label={`${shirt.title} — ${black ? "black" : "white"} tee`}
    >
      {/* Garment */}
      <svg
        viewBox={viewBox}
        className="absolute inset-0 h-full w-full"
        style={shadow ? { filter: "drop-shadow(0 18px 22px rgba(0,0,0,0.45))" } : undefined}
        aria-hidden
      >
        <path d={body} fill={fabric} />
        {/* armhole + shoulder seams */}
        <path d="M98 38 Q113 92 94 146 M302 38 Q287 92 306 146" fill="none" stroke={seam} strokeWidth={1.4} />
        {/* sleeve and body hems */}
        <path
          d="M28 126 L68 158 M372 126 L332 158 M94 422 Q200 432 306 422"
          fill="none"
          stroke={seam}
          strokeWidth={1.2}
          strokeDasharray="3 3"
        />
        {/* collar rib */}
        <path d="M150 24 Q200 36 250 24" fill="none" stroke={collar} strokeWidth={7} strokeLinecap="round" />
      </svg>

      {/* Print: single-ink, blended into the fabric (screen = white ink, multiply = black ink) */}
      <div className="absolute overflow-hidden" style={{ ...PRINT_STYLE, mixBlendMode: black ? "screen" : "multiply" }}>
        <PrintImage shirt={shirt} color={color} />
      </div>

      {/* Fabric folds — shadows */}
      <svg viewBox={viewBox} className="pointer-events-none absolute inset-0 h-full w-full" style={{ mixBlendMode: "multiply" }} aria-hidden>
        <defs>
          <clipPath id={clip}>
            <path d={body} />
          </clipPath>
          <linearGradient id={`side-${uid}`} x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity={0.55} />
            <stop offset="0.22" stopColor="#000" stopOpacity={0} />
            <stop offset="0.78" stopColor="#000" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id={`hem-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.8" stopColor="#000" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={0.35} />
          </linearGradient>
          <radialGradient id={`fold-${uid}`}>
            <stop offset="0" stopColor="#000" stopOpacity={0.5} />
            <stop offset="1" stopColor="#000" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g clipPath={`url(#${clip})`} opacity={black ? 0.85 : 0.3}>
          <rect x={92} y={20} width={216} height={420} fill={`url(#side-${uid})`} />
          <rect x={0} y={0} width={400} height={440} fill={`url(#hem-${uid})`} />
          <ellipse cx={100} cy={160} rx={26} ry={60} fill={`url(#fold-${uid})`} />
          <ellipse cx={300} cy={160} rx={26} ry={60} fill={`url(#fold-${uid})`} />
          <ellipse cx={250} cy={340} rx={16} ry={90} fill={`url(#fold-${uid})`} transform="rotate(18 250 340)" opacity={0.6} />
          <ellipse cx={150} cy={380} rx={12} ry={60} fill={`url(#fold-${uid})`} transform="rotate(-12 150 380)" opacity={0.5} />
          <ellipse cx={50} cy={120} rx={30} ry={14} fill={`url(#fold-${uid})`} transform="rotate(40 50 120)" opacity={0.5} />
          <ellipse cx={350} cy={120} rx={30} ry={14} fill={`url(#fold-${uid})`} transform="rotate(-40 350 120)" opacity={0.5} />
        </g>
      </svg>

      {/* Fabric folds — highlights */}
      <svg viewBox={viewBox} className="pointer-events-none absolute inset-0 h-full w-full" style={{ mixBlendMode: "screen" }} aria-hidden>
        <defs>
          <radialGradient id={`hi-${uid}`}>
            <stop offset="0" stopColor="#fff" stopOpacity={1} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g clipPath={`url(#${clip})`} opacity={black ? 0.12 : 0.05}>
          <ellipse cx={175} cy={200} rx={70} ry={150} fill={`url(#hi-${uid})`} />
          <ellipse cx={272} cy={300} rx={10} ry={80} fill={`url(#hi-${uid})`} transform="rotate(18 272 300)" />
          <ellipse cx={200} cy={40} rx={90} ry={16} fill={`url(#hi-${uid})`} />
        </g>
      </svg>
    </div>
  );
}
