import type { Metadata } from "next";
import { YoursView } from "@/components/upload/YoursView";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/make/yours/",
  title: "From yours — Make — MONO",
  description: "Your picture, drawing or words, printed in one ink on a black or white tee. Converted and checked on your device.",
});

export default function YoursPage() {
  return <YoursView />;
}
