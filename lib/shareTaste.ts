import { archetypeOf, encodeTaste } from "@/lib/taste";
import { topPicks } from "@/lib/match";
import { topTraits } from "@/lib/recommendation";
import { renderTasteImage } from "@/lib/shareImage";
import { shareOrCopy } from "@/lib/clipboard";
import { siteRoot } from "@/lib/share";
import { track } from "@/lib/analytics";
import { FEATURE_LABELS, type UserProfileVector } from "@/types/shirt";

/**
 * "Share my taste": a 9:16 card (archetype, top traits, three picks) and a
 * /?taste=… link a friend can compare with. Used by Your taste and the
 * taste-test screen.
 */
export async function shareTaste(vector: UserProfileVector) {
  const archetype = archetypeOf(vector);
  const traits = topTraits(vector, 3);
  const url = `${siteRoot()}/?taste=${encodeTaste(vector)}&utm_source=taste&utm_medium=share&utm_campaign=taste_profile`;
  const blob = await renderTasteImage(archetype.name, traits.map((k) => FEATURE_LABELS[k]), topPicks(vector, 3));
  const outcome = await shareOrCopy({ title: `${archetype.name} — MONO`, text: `My taste in tees: ${archetype.name}. What's yours?`, url, image: { blob, name: "mono-my-taste.png" } });
  // Counted only when it went somewhere (not when the sheet was dismissed).
  if (outcome === "shared" || outcome === "copied") track("share_taste", { method: outcome, archetype: archetype.name });
}
