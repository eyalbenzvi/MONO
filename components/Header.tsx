"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import { MonoLogo } from "@/components/MonoLogo";
import { useCartCount } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";

const TABS = [
  { href: "/", label: "Discover", match: (p: string) => p === "/" },
  { href: "/shop/", label: "Shop", match: (p: string) => p.startsWith("/shop") },
];

export function Header({ onOpenSaved }: { onOpenSaved: () => void }) {
  const pathname = usePathname() ?? "/";
  const activeTab = TABS.findIndex((t) => t.match(pathname));
  const hydrated = useUiStore((s) => s.hydrated);
  const savedCount = useTasteStore((s) => s.likedIds.length);
  const cartCount = useCartCount();
  const hidden = useUiStore((s) => s.headerHidden);
  const setHeaderHidden = useUiStore((s) => s.setHeaderHidden);
  const debug = useUiStore((s) => s.debug);
  const setDebug = useUiStore((s) => s.setDebug);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Always show the header again when the route changes.
  useEffect(() => setHeaderHidden(false), [pathname, setHeaderHidden]);

  // Publish the header's height (--header-h): main reserves it, and the
  // shop's sticky filter bar sits right under the header while it shows.
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const set = (h: number) => document.documentElement.style.setProperty("--header-h", `${Math.round(h)}px`);
    set(ref.current.getBoundingClientRect().height);
    const ro = new ResizeObserver(([e]) => set(e.target.getBoundingClientRect().height));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Hidden debug switch: tap the logo 5 times within 2 s.
  const taps = useRef<number[]>([]);
  const onLogoClick = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      setDebug(!debug);
      useUiStore.getState().showToast(debug ? "Debug off" : "Debug on");
    }
  };

  return (
    // Over the content, solid, and moved only by a transform: hiding and
    // showing never changes the layout, so nothing under the finger jumps.
    <motion.header
      ref={ref}
      className="app-backdrop absolute inset-x-0 top-0 z-30 px-4 pb-2 pt-[max(env(safe-area-inset-top),10px)] max-[339px]:px-3"
      initial={false}
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      // Tabbing into it while it's slid away brings it back.
      onFocusCapture={() => hidden && setHeaderHidden(false)}
    >
      {/* Narrow phones: everything must stay on screen (the bag above all).
          Below 400 px the tabs and icons tighten, below 340 the logo gives
          way. The Daily 5 streak lives in "Your taste" only. */}
      <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-2 sm:grid-cols-[1fr_auto_1fr] 2xl:max-w-[1400px] min-[1800px]:max-w-[1600px]">
        <Link href="/" onClick={onLogoClick} className="flex items-center gap-3 justify-self-start rounded-md transition active:scale-95 max-[339px]:hidden" aria-label="MONO home">
          <MonoLogo size="sm" />
          <span className="hidden text-xs uppercase tracking-[0.18em] text-neutral-400 sm:inline">Monochrome tees</span>
        </Link>

        {/* Rendered afresh once mounted: a page served at another address
            (404.html at /shop/…) hydrates with the markup built for the 404,
            and hydration never patches class names — the active tab's text
            would stay grey on the white pill. */}
        <nav key={mounted ? "client" : "server"} aria-label="Sections" className="justify-self-center">
          <div className="relative grid w-44 grid-cols-2 rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10 max-[399px]:w-40 max-[339px]:w-36">
            {/* One pill, always rendered, moved under the active tab: the
                markup never depends on the URL, so a page served at another
                address (404.html) still hydrates cleanly. */}
            <motion.span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white"
              initial={false}
              animate={{ x: activeTab === 1 ? "100%" : "0%", opacity: activeTab === -1 ? 0 : 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative z-10 flex h-9 items-center justify-center rounded-full text-sm font-semibold transition-colors max-[399px]:text-[13px] max-[339px]:text-xs ${
                    active ? "text-black" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2 justify-self-end max-[399px]:gap-2.5">
          <IconButton label={`Saved (${savedCount})`} count={hydrated ? savedCount : 0} onClick={onOpenSaved} savedTarget>
            <Heart className="h-5 w-5" />
          </IconButton>
          <IconButton label={`Bag (${cartCount})`} count={hydrated ? cartCount : 0} href="/cart/" active={pathname.startsWith("/cart")}>
            <ShoppingBag className="h-5 w-5" />
          </IconButton>
        </div>
      </div>
    </motion.header>
  );
}

function IconButton({
  label,
  count,
  onClick,
  href,
  savedTarget,
  active = false,
  children,
}: {
  label: string;
  count: number;
  onClick?: () => void;
  href?: string;
  /** Where the "liked" heart flies to. */
  savedTarget?: boolean;
  /** The page this icon leads to is open: filled, and aria-current. */
  active?: boolean;
  children: React.ReactNode;
}) {
  const className = `relative flex h-11 w-11 items-center justify-center rounded-full ring-1 transition active:scale-90 max-[399px]:h-10 max-[399px]:w-10 ${
    active ? "bg-white text-black ring-white" : "bg-white/5 ring-white/10 hover:bg-white/10"
  }`;
  const badge = (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.4, opacity: 0 }}
          // Pop on every change: 0.4 → 1.35 → 1.
          animate={{ scale: [0.4, 1.35, 1], opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.35, delay: savedTarget ? 0.4 : 0 }}
          className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-xs font-bold ${
            active ? "bg-black text-white ring-1 ring-white" : "bg-white text-black"
          }`}
        >
          {count}
        </motion.span>
      )}
    </AnimatePresence>
  );
  const target = savedTarget ? { "data-saved-target": "" } : {};
  return href ? (
    <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={className}>
      {children}
      {badge}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={className} {...target}>
      {children}
      {badge}
    </button>
  );
}
