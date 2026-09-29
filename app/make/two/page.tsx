import type { Metadata } from "next";
import { ForTwo } from "@/components/custom/ForTwo";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/make/two/",
  title: "For two — Make | MONO",
  description: "One date of yours, and every print it makes: the sky that night, the moon, the planets, your initials. Black or white tees.",
});

export default function ForTwoPage() {
  return <ForTwo />;
}
