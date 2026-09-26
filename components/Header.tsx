"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingBag, Flame } from "lucide-react";
import { MonoLogo } from "@/components/MonoLogo";
import { useCartCount } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { currentStreak } from "@/lib/taste";

const TABS = [
  { href: "/", label: "Discover", match: (p: string) => p === "/" },
  { href: "/shop/", label: "Shop", match: (p: string) => p.startsWith("/shop") },
];

export function Header({ onOpenSaved }: { onOpenSaved: () => void }) {
  const pathname = usePathname() ?? "/";
  const activeTab = TABS.findIndex((t) => t.match(pathname));
  const hydrated = useUiStore((s) => s.hydrated);
  const savedCount = useTasteStore((s) => s.likedIds.length);
  const streak = useTasteStore((s) => currentStreak(s.daily));
  const cartCount = useCartCount();
  const hidden = useUiStore((s) => s.headerHidden);
  const setHeaderHidden = useUiStore((s) => s.setHeaderHidden);
  const debug = useUiStore((s) => s.debug);
  const setDebug = useUiStore((s) => s.setDebug);

  // Always show the header again when the route changes.
  useEffect(() => setHeaderHidden(false), [pathname, setHeaderHidden]);

  // Measure so hiding can collapse the space (not just slide over content).
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setHeight(e.target.getBoundingClientRect().height));
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
    <motion.header
      ref={ref}
      className="relative z-20 shrink-0 px-4 pb-2 pt-[max(env(safe-area-inset-top),10px)]"
      animate={{ marginTop: hidden ? -height : 0, opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <Link href="/" onClick={onLogoClick} className="flex items-center gap-3 justify-self-start rounded-md transition active:scale-95" aria-label="MONO home">
          <MonoLogo size="sm" />
          <span className="hidden text-xs uppercase tracking-[0.18em] text-neutral-400 sm:inline">Monochrome tees</span>
          {/* Daily 5 streak (days in a row with five new swipes); only once there is one. */}
          {hydrated && streak > 0 && (
            <span className="flex items-center gap-0.5 font-mono text-xs text-neutral-300" title={`Daily 5 streak: ${streak} day${streak === 1 ? "" : "s"}`} aria-label={`Daily 5 streak: ${streak} days`}>
              <Flame className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              {streak}
            </span>
          )}
        </Link>

        <nav aria-label="Sections" className="justify-self-center">
          <div className="relative grid w-44 grid-cols-2 rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10">
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
                  className={`relative z-10 flex h-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    active ? "text-black" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
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
  const className = `relative flex h-11 w-11 items-center justify-center rounded-full ring-1 transition active:scale-90 ${
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
          className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[11px] font-bold ${
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
