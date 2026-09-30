"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProductView } from "@/components/shop/ProductView";
import { catalogReady, getShirtById } from "@/lib/catalog";

/**
 * Client-side product page for designs without a pre-rendered page (when the
 * build sets NEXT_PUBLIC_PRERENDER_LIMIT): /shop/p/?id=mono-0123. Details are
 * fetched from the shards. See productHref in lib/catalog.
 */
function ClientProduct() {
  const id = useSearchParams().get("id") ?? "";
  // The served page has a generic title (it serves every design): the tab and history get the design's own once it's known.
  useEffect(() => {
    if (!id) return;
    void catalogReady().then(() => {
      const s = getShirtById(id);
      if (s) document.title = `${s.title} | MONO`;
    }).catch(() => {});
  }, [id]);
  return <ProductView key={id} id={id} />;
}

export default function ClientProductPage() {
  return (
    <Suspense fallback={null}>
      <ClientProduct />
    </Suspense>
  );
}
