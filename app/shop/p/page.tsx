"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProductView } from "@/components/shop/ProductView";

/**
 * Client-side product page for designs without a pre-rendered page (when the
 * build sets NEXT_PUBLIC_PRERENDER_LIMIT): /shop/p/?id=mono-0123. Details are
 * fetched from the shards. See productHref in lib/catalog.
 */
function ClientProduct() {
  const id = useSearchParams().get("id") ?? "";
  return <ProductView key={id} id={id} />;
}

export default function ClientProductPage() {
  return (
    <Suspense fallback={null}>
      <ClientProduct />
    </Suspense>
  );
}
