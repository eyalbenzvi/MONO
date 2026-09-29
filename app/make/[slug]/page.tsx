import type { Metadata } from "next";
import { MakeView } from "@/components/custom/MakeView";
import { MADE, madeBySlug } from "@/lib/custom/products";
import { pageMeta } from "@/lib/seo";

// Only the pages built exist in the export; `next dev` (which errors on false with output: "export") renders any.
export const dynamicParams = process.env.NODE_ENV !== "production";

export function generateStaticParams() {
  return MADE.map((m) => ({ slug: m.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const m = madeBySlug(params.slug);
  if (!m) return {};
  return pageMeta({ path: `/make/${m.slug}/`, title: `${m.name} — Make — MONO`, description: `${m.line} ${m.from}, printed in one ink on a black or white tee.` });
}

export default function MakePage({ params }: { params: { slug: string } }) {
  return <MakeView slug={params.slug} />;
}
