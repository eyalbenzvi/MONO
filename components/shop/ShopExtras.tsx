"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";
import { TeeMockup } from "@/components/TeeMockup";
import { STAGE_BG } from "@/components/ui";
import { fetchTrending } from "@/lib/api";
import { getShirtById, productHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { ShirtProduct } from "@/types/shirt";

function Strip({ title, shirts, onClose }: { title: string; shirts: ShirtProduct[]; onClose?: () => void }) {
  return (
    <section className="mb-4" aria-label={title}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={`Hide ${title}`} className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {shirts.map((s) => (
          <li key={s.id} className="flex w-28 shrink-0 flex-col gap-1.5">
            <Link href={productHref(s.id)} className={`rounded-xl p-1.5 ${STAGE_BG}`} aria-label={`${s.title}, ${formatPrice(s.price)}`}>
              <TeeMockup shirt={s} shadow={false} className="w-full" />
            </Link>
            <p className="truncate text-xs text-neutral-300">{s.title}</p>
            <QuickAdd shirt={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A friend's list from "Share my list" (/shop/?list=12.340.2001): shown on
 * top of the shop until closed. The parameter is removed from the address bar.
 */
export function SharedList() {
  const [shirts, setShirts] = useState<ShirtProduct[]>([]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get("list");
    if (raw === null) return;
    const found = raw
      .split(".")
      .slice(0, 60)
      .map((n) => (/^\d{1,4}$/.test(n) ? getShirtById(`mono-${n.padStart(4, "0")}`) : undefined))
      .filter((s): s is ShirtProduct => !!s);
    setShirts([...new Map(found.map((s) => [s.id, s])).values()]);
    for (const k of ["list", "utm_source", "utm_medium", "utm_campaign"]) q.delete(k);
    const rest = q.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, []);
  if (shirts.length === 0) return null;
  return <Strip title={`A shared list · ${shirts.length} tee${shirts.length === 1 ? "" : "s"}`} shirts={shirts} onClose={() => setShirts([])} />;
}

/**
 * "Most swiped right this week" — only with real data from the API
 * (lib/api fetchTrending). Without an API there is no data, so nothing is
 * rendered: never an invented number or list.
 */
export function Trending() {
  const [data, setData] = useState<{ label: string; shirts: ShirtProduct[] } | null>(null);
  useEffect(() => {
    let live = true;
    void fetchTrending().then((t) => {
      if (!live || !t) return;
      const shirts = t.ids.map((id) => getShirtById(id)).filter((s): s is ShirtProduct => !!s).slice(0, 12);
      if (shirts.length) setData({ label: t.label, shirts });
    });
    return () => {
      live = false;
    };
  }, []);
  if (!data) return null;
  return <Strip title={data.label} shirts={data.shirts} />;
}
