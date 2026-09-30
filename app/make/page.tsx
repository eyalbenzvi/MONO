import type { Metadata } from "next";
import { MakeIndex } from "@/components/custom/MakeIndex";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/make/",
  title: "Make | MONO",
  description: "Our prints, made yours from a date, a name, a place or your people. One ink, black or white.",
});

export default function MakeIndexPage() {
  return <MakeIndex />;
}
