import type { Metadata } from "next";
import { MakeIndex } from "@/components/custom/MakeIndex";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/make/",
  title: "Make — MONO",
  description: "One ink, for one person: our designs, made yours from a night, a moon, a day or a year. Black or white tees.",
});

export default function MakeIndexPage() {
  return <MakeIndex />;
}
