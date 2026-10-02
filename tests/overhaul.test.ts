// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import full from "@/data/shirts.json";
import retired from "@/data/curation/retired.json";
import window from "@/data/curation/window.json";
import { SHIRTS, getShirtById } from "@/lib/catalog";
import { buildDeck, wildcard, CATEGORY_SPACING } from "@/lib/deck";
import { SHOP_WINDOW, rankShirts } from "@/lib/recommendation";
import { SHIRT_CATEGORIES, createInitialVector, type CatalogEntry } from "@/types/shirt";
import { WINK_CAP } from "../scripts/gen/describe";
import { isWeak } from "../scripts/gen/quality";
import { W1 } from "./fixtures";

const FULL = full as unknown as CatalogEntry[];
const byId = new Map(FULL.map((s) => [s.id, s]));
const ROOT = path.resolve(__dirname, "..");

/** Designs the content overhaul took out: a knockout (Part 0), a word-salad print (Part 1), a stock-titled repeat (Part 5). */
const REMOVED = [Object.keys(retired)[0], "mono-0003", "mono-0001"];

describe("content overhaul: removed designs degrade gracefully", () => {
  beforeEach(() => localStorage.clear());

  it("a removed id is simply not in the catalogue", () => {
    for (const id of REMOVED) expect(getShirtById(id), id).toBeUndefined();
  });

  it("a stored profile and bag that point at removed designs drop them and keep the rest", async () => {
    localStorage.setItem("mono-taste", JSON.stringify({ state: { likedIds: [...REMOVED, W1], dislikedIds: [REMOVED[1]], seen: [...REMOVED, W1], onboardingSeen: true }, version: 5 }));
    localStorage.setItem("mono-cart", JSON.stringify({ state: { cart: [...REMOVED, W1].map((id) => ({ id, size: "M", color: byId.get(W1)!.baseColor, qty: 1 })) }, version: 4 }));
    vi.resetModules();
    const { useTasteStore } = await import("@/store/tasteStore");
    const { useCartStore } = await import("@/store/cartStore");
    await useTasteStore.persist.rehydrate();
    await useCartStore.persist.rehydrate();
    expect(useTasteStore.getState().likedIds).toEqual([W1]);
    expect(useTasteStore.getState().dislikedIds).toEqual([]);
    expect(useCartStore.getState().cart.map((l) => l.id)).toEqual([W1]);
    // The deck deals from what's left.
    useTasteStore.getState().fillDeck();
    expect(useTasteStore.getState().deck.every((e) => getShirtById(e.id))).toBe(true);
  });
});

describe("taste store v5 (the taste test's prints changed)", () => {
  beforeEach(() => localStorage.clear());

  it("whoever answered a whole test's worth of cards stays finished; a half-done test stays half done", async () => {
    const ids = SHIRTS.slice(0, 12).map((s) => s.id);
    localStorage.setItem("mono-taste", JSON.stringify({ state: { likedIds: ids.slice(0, 6), dislikedIds: ids.slice(6, 10), seen: ids.slice(0, 10), calibrationAcknowledged: false, onboardingSeen: true }, version: 4 }));
    vi.resetModules();
    let mod = await import("@/store/tasteStore");
    await mod.useTasteStore.persist.rehydrate();
    expect(mod.useTasteStore.getState().calibrationAcknowledged).toBe(true);
    expect(mod.tasteProgress(mod.useTasteStore.getState()).phase).not.toBe("test");

    localStorage.setItem("mono-taste", JSON.stringify({ state: { likedIds: ids.slice(0, 2), dislikedIds: ids.slice(2, 4), seen: ids.slice(0, 4), calibrationAcknowledged: false, onboardingSeen: true }, version: 4 }));
    vi.resetModules();
    mod = await import("@/store/tasteStore");
    await mod.useTasteStore.persist.rehydrate();
    expect(mod.useTasteStore.getState().calibrationAcknowledged).toBe(false);
    mod.useTasteStore.getState().toggleSaved(W1);
    expect(JSON.parse(localStorage.getItem("mono-taste")!).version).toBe(6);
  });
});

describe("Part 7: Our pick opens on the shop window", () => {
  const win = FULL.filter((s) => s.rank < SHOP_WINDOW).sort((a, b) => a.rank - b.rank);
  /**
   * A catalogue too thin for the full rules (the designers' second review left about 130 designs): the window the
   * rules can build comes first and holds them (every category, one per subject and family, strong prints, never two
   * of one category side by side); the rest of the first SHOP_WINDOW are the best that remain.
   */
  const windowThin = () => {
    const cats = new Map<string, number>();
    const seen = { subject: new Set<string>(), family: new Set<string>() };
    let k = 0;
    for (const s of win) {
      if ((cats.get(s.category) ?? 0) >= 3 || seen.subject.has(s.subject.toLowerCase()) || seen.family.has(s.family)) break;
      cats.set(s.category, (cats.get(s.category) ?? 0) + 1), seen.subject.add(s.subject.toLowerCase()), seen.family.add(s.family), k++;
    }
    expect(cats.size).toBe(SHIRT_CATEGORIES.length);
    expect(k).toBeGreaterThanOrEqual(SHIRT_CATEGORIES.length);
    for (let i = 1; i < k; i++) expect(win[i].category, win[i].id).not.toBe(win[i - 1].category);
  };

  it("its first slots are the ones pinned by hand, in order", () => {
    expect(window.length).toBeGreaterThanOrEqual(1);
    expect(win.slice(0, window.length).map((s) => s.id)).toEqual(window);
  });

  it("every category, at most three of one, one per subject and family, top 30% quality, four archive works, never two of one category side by side", () => {
    expect(win).toHaveLength(SHOP_WINDOW);
    if (FULL.length <= 600) return windowThin();
    const cats = new Map<string, number>();
    for (const s of win) cats.set(s.category, (cats.get(s.category) ?? 0) + 1);
    expect(cats.size).toBeGreaterThanOrEqual(10);
    // At most three of one category, unless the catalogue is too thin to fill the window otherwise (the designers'
    // second review left about 130 designs: then the strongest categories fill the rest).
    if (FULL.length > 600) expect(Math.max(...cats.values())).toBeLessThanOrEqual(3);
    for (const c of ["specimens", "photographs", "brush"]) expect(cats.get(c), c).toBeGreaterThanOrEqual(1);
    expect(new Set(win.map((s) => s.subject.toLowerCase())).size).toBe(SHOP_WINDOW);
    expect(new Set(win.map((s) => s.family)).size).toBe(SHOP_WINDOW);
    const drawn = win.filter((s) => s.medium === "drawn").map((s) => s.variant);
    expect(new Set(drawn).size, "one per drawn template").toBe(drawn.length);
    const q = FULL.map((s) => s.quality).sort((a, b) => a - b);
    for (const s of win) {
      expect(s.quality, s.id).toBeGreaterThanOrEqual(q[Math.floor(q.length * 0.7)]);
      expect(isWeak(s), s.id).toBe(false);
    }
    expect(win.filter((s) => s.variant.startsWith("archive-")).length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < win.length; i++) expect(win[i].category, win[i].id).not.toBe(win[i - 1].category);
  });

  it("the daily rotation never moves the window; the shop shows it as built", () => {
    const v = createInitialVector();
    for (const day of ["a", "b", "c"]) {
      const top = rankShirts(v, SHIRTS, "popular", { rotate: day }).slice(0, SHOP_WINDOW).map((r) => r.shirt.id);
      expect(top).toEqual(win.map((s) => s.id));
    }
    const view = readFileSync(path.join(ROOT, "components/shop/ShopView.tsx"), "utf8");
    const list = readFileSync(path.join(ROOT, "components/shop/shopList.ts"), "utf8");
    // Before the taste test the order is "Our pick" (no sort to choose); a category filter or a search leaves the window, a colour keeps it.
    expect(list).toMatch(/sort === "popular" && !cats\.length && !result \? filtered\.filter\(\(\{ shirt \}\) => shirt\.rank < SHOP_WINDOW\)/);
    expect(view).toContain('const sort: ShopSort = complete ? "match" : "popular";');
  });

  it("no subject appears twice anywhere in the catalogue (so never twice in any 24)", () => {
    expect(new Set(FULL.map((s) => s.subject.toLowerCase())).size).toBe(FULL.length);
  });
});

describe("Part 8: For you, simulated for three tastes", () => {
  it("each sees at least six categories in the first 24, and no subject twice", async () => {
    const { dedupeByFamily, diversify } = await import("@/lib/catalog");
    const { updateUserVector } = await import("@/lib/recommendation");
    const tastes: ((s: (typeof SHIRTS)[number]) => boolean)[] = [(s) => s.medium === "photo", (s) => s.category === "systems" || s.category === "pattern", (s) => ["etched", "brush", "specimens"].includes(s.category)];
    for (const likes of tastes) {
      let v = createInitialVector();
      const strong = SHIRTS.filter((s) => !s.weak);
      strong.filter(likes).slice(0, 8).forEach((s) => (v = updateUserVector(v, s.features, "like")));
      strong.filter((s) => !likes(s)).slice(0, 6).forEach((s) => (v = updateUserVector(v, s.features, "dislike")));
      const top = diversify(dedupeByFamily(rankShirts(v, SHIRTS, "match", { rotate: "day" })), { category: true, color: true, wildcardEvery: 8 }).slice(0, 24);
      expect(new Set(top.map((x) => x.shirt.category)).size).toBeGreaterThanOrEqual(6);
      expect(new Set(top.map((x) => byId.get(x.shirt.id)!.subject)).size).toBe(24);
    }
  });
});

describe("Part 7: the Discover deck", () => {
  it("never more than two of one category in any five cards; a drawn template is dealt once", () => {
    let rnd = 7;
    const rng = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    const history: string[] = [];
    let deck = buildDeck([], createInitialVector(), history, [], rng);
    for (let k = 0; k < 60; k++) {
      history.push(deck[0].id);
      deck = buildDeck(deck.slice(1), createInitialVector(), history, [], rng);
    }
    const cats = history.map((id) => getShirtById(id)!.category);
    expect(CATEGORY_SPACING).toBeGreaterThanOrEqual(2);
    // While other categories are left to deal (in a thin catalogue one category is all that's left near the end).
    // (A drawn template is dealt once, before any pacing: a template already dealt isn't an alternative.)
    const cardsLeft = (i: number) => {
      const shown = history.slice(0, i).map((id) => getShirtById(id)!);
      const used = new Set(shown.filter((x) => x.medium === "drawn").map((x) => x.variant));
      return SHIRTS.filter((s) => !shown.some((x) => x.family === s.family) && (s.medium !== "drawn" || !used.has(s.variant)));
    };
    // Each card keeps off the last two cards' categories (so no more than two of one in any five) whenever a card
    // that also keeps off the last five's algorithms was left to deal.
    for (let i = 2; i < cats.length; i++) {
      const recentVariants = history.slice(Math.max(0, i - 5), i).map((id) => getShirtById(id)!.variant);
      const alternative = cardsLeft(i).some((s) => !cats.slice(i - 2, i).includes(s.category) && !recentVariants.includes(s.variant));
      if (alternative) expect(cats.slice(i - 2, i), `${i}: ${cats.slice(i - 4, i + 1)}`).not.toContain(cats[i]);
    }
    const drawn = history.map((id) => getShirtById(id)!).filter((s) => s.medium === "drawn").map((s) => s.variant);
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it("a wildcard is the best print from the category shown least", () => {
    const shown = SHIRTS.filter((s) => s.category === "etched").slice(0, 3).map((s) => s.id);
    const pool = SHIRTS.filter((s) => !shown.includes(s.id));
    const pick = wildcard(pool, shown)!;
    expect(pick.shirt.category).not.toBe("etched");
    expect(pick.shirt.weak).toBe(false);
    const same = pool.filter((s) => s.category === pick.shirt.category && !s.weak);
    expect(Math.min(...same.map((s) => s.rank))).toBe(pick.shirt.rank);
  });
});

describe("Part 5: copy", () => {
  it("no closing line (a wink) is used more than WINK_CAP times; nothing is 'special' or 'premium'", () => {
    const tails = new Map<string, number>();
    for (const s of FULL) {
      const tail = s.description.slice(s.summary.length).trim();
      if (tail && !tail.startsWith("The print measures")) tails.set(tail, (tails.get(tail) ?? 0) + 1);
      // Our own words only: a real name keeps its word ("Pitts S-1S Special").
      expect(s.description.replace(s.subject, "").replace(s.title, ""), s.id).not.toMatch(/\bspecial\b|\bpremium\b|Quietly/i);
    }
    expect(WINK_CAP).toBe(20);
    expect(Math.max(...tails.values())).toBeLessThanOrEqual(WINK_CAP);
  });

  it("a colour in a title comes with a note that the print is one ink", () => {
    const coloured = FULL.filter((s) => /\b(red|scarlet|blue|green|yellow|golden|gold|silver|purple|pink|orange|grey|gray|brown)\b/i.test(s.title));
    expect(coloured.length).toBeGreaterThan(0);
    for (const s of coloured) expect(s.description, s.id).toMatch(/one[- ]ink/i);
  });

  it("a title that is its subject isn't said twice in the meta description", async () => {
    const { productDescription } = await import("@/lib/seo");
    const same = FULL.find((s) => s.title === s.subject)!;
    expect(productDescription(same).startsWith(`${same.title}. `)).toBe(true);
    const other = FULL.find((s) => s.title !== s.subject)!;
    expect(productDescription(other).startsWith(`${other.title}: ${other.subject}. `)).toBe(true);
  });

  it("the site's description: one ink, black and white, ten swipes edit the shop (and no false count)", () => {
    for (const f of ["app/layout.tsx", "app/page.tsx"]) {
      expect(readFileSync(path.join(ROOT, f), "utf8")).toContain('"One-ink tees in black and white. Swipe ten and the shop edits itself to your taste."');
    }
    // No count of designs in the description, so none goes stale as the catalogue changes.
    for (const f of ["app/layout.tsx", "app/page.tsx"]) expect(readFileSync(path.join(ROOT, f), "utf8")).not.toMatch(/\d[\d,]* (tees|designs)/);
  });
});
