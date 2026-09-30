"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MonoLogo } from "@/components/MonoLogo";
import { useUiStore } from "@/store/useUiStore";

/**
 * The top of every page: only the wordmark, which leads home (Discover).
 * Navigation is at the bottom (TabBar), within the thumb.
 */
export function Header() {
  const pathname = usePathname() ?? "/";
  const hidden = useUiStore((s) => s.headerHidden);
  const setHeaderHidden = useUiStore((s) => s.setHeaderHidden);

  // Always show the header again when the route changes.
  useEffect(() => setHeaderHidden(false), [pathname, setHeaderHidden]);

  // Publish the header's height (--header-h): main reserves it, and pages
  // that scroll under it start below it.
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const set = (h: number) => document.documentElement.style.setProperty("--header-h", `${Math.round(h)}px`);
    set(ref.current.getBoundingClientRect().height);
    const ro = new ResizeObserver(([e]) => set(e.target.getBoundingClientRect().height));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    // Over the content, solid, and moved only by a transform: hiding and
    // showing never changes the layout, so nothing under the finger jumps.
    <motion.header
      ref={ref}
      className="absolute inset-x-0 top-0 z-header bg-[#0a0a0a] px-4 pt-[env(safe-area-inset-top)]"
      initial={false}
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
      // Tabbing into it while it's slid away brings it back.
      onFocusCapture={() => hidden && setHeaderHidden(false)}
    >
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-center 2xl:max-w-[1400px]">
        <Link href="/" aria-label="MONO, home" className="flex min-h-11 min-w-11 items-center justify-center px-2">
          <MonoLogo />
        </Link>
      </div>
    </motion.header>
  );
}
