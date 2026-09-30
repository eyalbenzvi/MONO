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

/**
 * Where the tab bar gives way to the page's own bottom bar: a product page
 * (its buy bar), the Make editors with a buy bar (/make/<slug>, /make/two,
 * /make/yours), and the bag and checkout (their sticky button). The Make
 * index keeps it.
 */
export function tabBarHidden(pathname: string): boolean {
  if (/^\/shop\/(p\/|[^/?#]+\/?$)/.test(pathname)) return true;
  if (/^\/make\/.+/.test(pathname)) return true;
  return pathname.startsWith("/cart");
}

/** Bar height before the safe area (px). */
export const TAB_BAR_H = 52;

/**
 * The main navigation, at the bottom within the thumb: Discover · Shop ·
 * Make · Bag · You. Hidden during the taste test (focus mode: it appears
 * after the reveal) and wherever a page has its own bottom bar.
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
  const hidden = tabBarHidden(pathname) || (onDiscover && !(hydrated && acknowledged));
  const nav = useRef<HTMLElement>(null);
  useDock(nav, !hidden);

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
          const label = tab.label === "Bag" && hydrated && count > 0 ? `Bag ${count}` : tab.label;
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                {...(tab.label === "You" ? { "data-saved-target": "" } : {})}
                onClick={(e) => {
                  // The tab you're on takes you to the top of it.
                  if (!active) return;
                  e.preventDefault();
                  scrollPageToTop();
                }}
                className={`flex h-full min-h-11 items-center justify-center whitespace-nowrap text-[13px] font-medium transition-colors duration-150 ${active ? "text-white" : "text-muted hover:text-white"}`}
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
