"use client";

import { useState } from "react";
import { assetUrl } from "@/lib/catalog";
import type { ShirtProduct } from "@/types/shirt";

/** The flat print artwork: a local monochrome 3:4 SVG from /public/prints. */
export function PrintImage({ shirt, className = "" }: { shirt: ShirtProduct; className?: string }) {
  const [failed, setFailed] = useState(false);
  // Blank ground in the tee colour if a file is ever missing, so nothing looks broken.
  if (failed) return <div className={`h-full w-full ${shirt.baseColor === "black" ? "bg-black" : "bg-white"} ${className}`} />;
  return (
    <img
      src={assetUrl(shirt.backPrintUrl)}
      alt={`${shirt.title} print`}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-full w-full select-none object-cover ${className}`}
    />
  );
}
