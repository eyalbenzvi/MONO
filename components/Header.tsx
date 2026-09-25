"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import { MonoLogo } from "@/components/MonoLogo";
import { useCartCount, useShirtStore } from "@/store/useShirtStore";

const TABS = [
  { href: "/", label: "Discover", match: (p: string) => p === "/" },
  { href: "/shop/", label: "Shop", match: (p: string) => p.startsWith("/shop") },
];

export function Header({ onOpenSaved }: { onOpenSaved: () => void }) {
  const pathname = usePathname() ?? "/";
  const hydrated = useShirtStore((s) => s.hydrated);
  const savedCount = useShirtStore((s) => s.likedIds.length);
  const cartCount = useCartCount();

  return (
    <header className="relative z-20 shrink-0 px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 rounded-md transition active:scale-95" aria-label="MONO home">
          <MonoLogo size="sm" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Monochrome tees</span>
        </Link>

        <div className="flex items-center gap-2">
          <IconButton label={`Saved (${savedCount})`} count={hydrated ? savedCount : 0} onClick={onOpenSaved}>
            <Heart className="h-5 w-5" />
          </IconButton>
          <IconButton label={`Bag (${cartCount})`} count={hydrated ? cartCount : 0} href="/cart/">
            <ShoppingBag className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      <nav className="mx-auto mt-3 flex max-w-5xl" aria-label="Sections">
        <div className="relative grid w-full grid-cols-2 rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10 sm:w-72">
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
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-white"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function IconButton({
  label,
  count,
  onClick,
  href,
  children,
}: {
  label: string;
  count: number;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const className =
    "relative flex h-11 w-11 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition active:scale-90 hover:bg-white/10";
  const badge = (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 font-mono text-[11px] font-bold text-black"
        >
          {count}
        </motion.span>
      )}
    </AnimatePresence>
  );
  return href ? (
    <Link href={href} aria-label={label} className={className}>
      {children}
      {badge}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {children}
      {badge}
    </button>
  );
}
