"use client";

import { useEffect } from "react";
import { productHref } from "@/lib/catalog";
import { BASE_PATH } from "@/lib/share";

/** The short share page's way on: straight to the product page, the link's # tag (channel, colour) kept. */
export function ShortRedirect({ id }: { id: string }) {
  const href = productHref(id);
  useEffect(() => {
    window.location.replace(`${BASE_PATH}${href}${window.location.hash}`);
  }, [href]);
  return (
    <main className="flex min-h-[50dvh] items-center justify-center px-4">
      <a href={`${BASE_PATH}${href}`} className="text-sm text-muted underline underline-offset-4">
        Open the tee
      </a>
    </main>
  );
}
