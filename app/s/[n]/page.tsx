import type { Metadata } from "next";
import { PRERENDERED } from "@/lib/catalog";
import { productMetadata } from "@/lib/productMeta";
import { ShortRedirect } from "@/components/ShortRedirect";

/**
 * A design's short share address, /s/<n>/ (lib/share productShareUrl): the shortest link the site can
 * serve itself. The page carries the product's own link preview in its HTML (no redirect for a chat
 * app to follow before the picture: WhatsApp builds the preview on the sender's phone, and an extra hop
 * left it without the image), and sends a visitor on to the product page, keeping the link's # tag.
 */
export const dynamicParams = process.env.NODE_ENV !== "production";

export function generateStaticParams() {
  return PRERENDERED.filter((s) => /^mono-\d+$/.test(s.id)).map((s) => ({ n: s.id.slice(5) }));
}

export function generateMetadata({ params }: { params: { n: string } }): Metadata {
  return productMetadata(`mono-${params.n}`, { short: true });
}

export default function ShortPage({ params }: { params: { n: string } }) {
  return <ShortRedirect id={`mono-${params.n}`} />;
}
