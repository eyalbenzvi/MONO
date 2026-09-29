"use client";

import { useEffect, useState } from "react";
import { loadFontCss, withFonts } from "@/lib/custom/raster";

/** "Print" (the print alone) for a personalised print: the SVG itself, its font inside (an image can't load one). */
export function CustomPrint({ svg, className = "" }: { svg: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    loadFontCss().then((css) => {
      if (!live) return;
      url = URL.createObjectURL(new Blob([withFonts(svg, css)], { type: "image/svg+xml" }));
      setSrc(url);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [svg]);
  return src ? <img src={src} alt="" draggable={false} className={`h-full w-full select-none object-cover ${className}`} data-custom-print /> : null;
}
