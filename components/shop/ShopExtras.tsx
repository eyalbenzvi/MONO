"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ShirtStrip } from "@/components/ShirtStrip";
import { getShirtById } from "@/lib/catalog";
import { updateQuery } from "@/lib/url";
import type { ShirtProduct } from "@/types/shirt";

function Strip({ title, shirts, onClose }: { title: string; shirts: ShirtProduct[]; onClose?: () => void }) {
  return (
    <section className="mb-4" aria-label={title}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={`Hide ${title}`} className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:text-white">
            <Icon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>
      <ShirtStrip shirts={shirts} quickAdd source="shared_list" />
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
    updateQuery((p) => ["list", "utm_source", "utm_medium", "utm_campaign"].forEach((k) => p.delete(k)), { keepHash: false });
  }, []);
  if (shirts.length === 0) return null;
  return <Strip title={`A shared list · ${shirts.length} tee${shirts.length === 1 ? "" : "s"}`} shirts={shirts} onClose={() => setShirts([])} />;
}

