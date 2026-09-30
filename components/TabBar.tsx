"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDock } from "@/hooks/useDock";
import { useCartCount } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";

/** The five places, in words (no icons, no pill): the active one is white and underlined. */
const TABS = [
  { href: "/", label: "Discover", match: (p: string) => p === "/" },
  { href: "/shop/", label: "Shop", match: (p: string) => p.startsWith("/shop") },
  { href: "/make/", label: "Make", match: (p: string) => p.startsWith("/make") },
  { href: "/cart/", label: "Bag", match: (p: string) => p.startsWith("/cart") },
  { href: "/me/", label: "You", match: (p: string) => p.startsWith("/me") },
] as const;

/** Bar height before the safe area (px). */
export const TAB_BAR_H = 52;

/**
 * The main navigation, at the bottom within the thumb: Discover · Shop ·
 * Make · Bag · You. Always there (a page's own buy bar sits above it), but
 * for the first taste test: focus mode, it appears after the reveal.
 */
export function TabBar() {
  const pathname = usePathname() ?? "/";
  const hydrated = useUiStore((s) => s.hydrated);
  const acknowledged = useTasteStore((s) => s.calibrationAcknowledged);
  const count = useCartCount();
  // Rendered afresh once mounted: a page served at another address (404.html
  // at /shop/…) hydrates with markup built for another path.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const onDiscover = pathname === "/";
  const hidden = onDiscover && !(hydrated && acknowledged);
  const nav = useRef<HTMLElement>(null);
  // After mount: the nav is drawn afresh then (its key), and the measure must be of that one.
  useDock(nav, !hidden && mounted);
  // Its height as --tabbar: a page's bar fixed at the foot sits above it, and adds the safe area only when it's gone.
  useEffect(() => {
    const el = nav.current;
    const set = (px: number) => document.documentElement.style.setProperty("--tabbar", `${px}px`);
    if (hidden || !mounted || !el) return set(0);
    const ro = new ResizeObserver(() => set(el.offsetHeight));
    ro.observe(el);
    set(el.offsetHeight);
    return () => {
      ro.disconnect();
      set(0);
    };
  }, [hidden, mounted]);

  // Hidden, not left out: the markup stays the same shape whichever path it was
  // built for, so 404.html served at a product address still hydrates.
  return (
    <nav
      ref={nav}
      key={mounted ? "client" : "server"}
      hidden={hidden}
      aria-label="Main"
      className="relative z-header shrink-0 border-t border-white/10 bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5" style={{ height: TAB_BAR_H }}>
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          // On the tab's own page (not a tee or an editor under it): a tap goes to the top; elsewhere under it, back to it.
          const home = pathname.replace(/\/?$/, "/") === tab.href;
          const label = tab.label === "Bag" && hydrated && count > 0 ? `Bag ${count}` : tab.label;
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={home ? "page" : active ? "true" : undefined}
                {...(tab.label === "You" ? { "data-saved-target": "" } : {})}
                onClick={(e) => {
                  // The tab you're on takes you to the top of it.
                  if (!home) return;
                  e.preventDefault();
                  scrollPageToTop();
                }}
                className={`flex h-full min-h-11 items-center justify-center whitespace-nowrap text-[13px] font-medium transition-colors duration-150 ${active ? "text-white" : "text-muted [@media(hover:hover)]:hover:text-white"}`}
              >
                <span className={`border-b pb-0.5 ${active ? "border-white" : "border-transparent"}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Every scrolled region of the page back to its top (each page scrolls its own column). */
function scrollPageToTop() {
  const main = document.querySelector("main");
  if (!main) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const el of [main, ...Array.from(main.querySelectorAll<HTMLElement>("*"))]) {
    if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }
}
