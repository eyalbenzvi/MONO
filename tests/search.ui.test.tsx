// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SearchPanel, { type SearchBoxProps } from "@/components/shop/SearchPanel";
import { shopList } from "@/components/shop/shopList";
import { SHIRTS, dedupeByFamily, diversify, filterShop } from "@/lib/catalog";
import { SHOP_WINDOW, rankShirts } from "@/lib/recommendation";
import * as mod from "@/lib/search/runtime";
import { createInitialVector } from "@/types/shirt";
import { realIndex } from "./searchFixture";

const { index } = realIndex();
const runtime = { mod, index };

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

function setup(over: Partial<SearchBoxProps> = {}) {
  const query = over.query ?? "";
  const facets = over.facets ?? [];
  const props: SearchBoxProps = {
    runtime,
    query,
    facets,
    result: query || facets.length ? mod.search(index, SHIRTS, { query, facets }) : null,
    count: 12,
    literal: false,
    tasteKnown: false,
    focusNonce: 0,
    onQuery: vi.fn(),
    onFacets: vi.fn(),
    onLiteral: vi.fn(),
    onCommit: vi.fn(),
    onClose: vi.fn(),
    onClear: vi.fn(),
    ...over,
  };
  render(<SearchPanel {...props} />);
  const field = screen.getByRole("combobox", { name: "Search tees" });
  return { props, field };
}

describe("search: the open search box", () => {
  it("focused and empty, it lists the prepared parameters — only groups with values, nothing personal before the taste is known", () => {
    const { field } = setup();
    fireEvent.focus(field);
    const groups = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(groups).toEqual(expect.arrayContaining(["Look", "Subject", "Made", "Era"]));
    // The tee colour stays on the row's dots, not repeated here.
    expect(groups).not.toContain("Tee");
    expect(groups).not.toContain("Your edit");
    expect(groups).not.toContain("Recent");
    // Every chip comes from the index: a LOOK chip for each look tag with designs.
    for (const t of index.file.tables.look) screen.getByRole("button", { name: t.label });
  });

  it("with the taste known, Your edit appears; a recent search is listed and can be forgotten", () => {
    mod.pushRecent("waves");
    const { field } = setup({ tasteKnown: true });
    fireEvent.focus(field);
    const groups = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(groups).toContain("Your edit");
    expect(groups).toContain("Recent");
    fireEvent.click(screen.getByRole("button", { name: "Forget waves" }));
    expect(screen.queryByRole("button", { name: "waves" })).toBeNull();
  });

  it("a tapped LOOK chip becomes a facet", () => {
    const { field, props } = setup();
    fireEvent.focus(field);
    const look = index.file.tables.look[0];
    fireEvent.click(screen.getByRole("button", { name: look.label }));
    expect(props.onFacets).toHaveBeenCalledWith([{ kind: "look", value: look.id }]);
  });

  it("while typing: one row of suggestions; accepting a facet suggestion adds its pill", () => {
    const artist = index.file.tables.artist[0];
    const word = artist.label.split(" ").pop()!.toLowerCase();
    const { field, props } = setup({ query: word.slice(0, 5) });
    fireEvent.focus(field);
    const option = screen.getAllByRole("option").find((o) => o.textContent?.includes("artist") && o.textContent.includes(artist.label))!;
    expect(option).toBeTruthy();
    fireEvent.click(option);
    expect(props.onFacets).toHaveBeenCalledWith([{ kind: "artist", value: artist.id }]);
  });

  it("arrow keys move through the suggestions and Enter takes the one selected", () => {
    const { field, props } = setup({ query: "ligh" });
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onQuery).toHaveBeenCalledWith(expect.stringMatching(/^ligh\S* $/));
    expect(props.onCommit).not.toHaveBeenCalled();
  });

  it("Backspace in an empty field removes the last pill", () => {
    const facets = [
      { kind: "look", value: index.file.tables.look[0].id },
      { kind: "medium", value: index.file.tables.medium[0].id },
    ] as SearchBoxProps["facets"];
    const { field, props } = setup({ facets });
    screen.getByRole("button", { name: `Remove ${index.file.tables.medium[0].label}` });
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(props.onFacets).toHaveBeenCalledWith([facets[0]]);
  });

  it("Esc clears the words first, then closes", () => {
    const a = setup({ query: "wave" });
    fireEvent.keyDown(a.field, { key: "Escape" });
    expect(a.props.onQuery).toHaveBeenCalledWith("");
    expect(a.props.onClose).not.toHaveBeenCalled();
    cleanup();
    const b = setup();
    fireEvent.keyDown(b.field, { key: "Escape" });
    expect(b.props.onClose).toHaveBeenCalled();
  });

  it("the count line; a correction offers the words as typed; no exact match says so and offers Clear", () => {
    setup({ query: "wave ", count: 26 });
    expect(screen.getByText(/^26 tees$/)).toBeTruthy();
    cleanup();
    const word = SHIRTS.map((s) => s.title.split(" ")[0].toLowerCase()).find((w) => /^[a-z]{7,}$/.test(w))!;
    const typo = `${word.slice(0, 2)}${word[3]}${word[2]}${word.slice(4)}`;
    const t = setup({ query: `${typo} ` });
    const offer = screen.getByRole("button", { name: `Search for “${typo}”` });
    fireEvent.click(offer);
    expect(t.props.onLiteral).toHaveBeenCalled();
    cleanup();
    const z = setup({ query: "zzqxv " });
    screen.getByText(/No exact match for “zzqxv”\. Closest:/);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(z.props.onQuery).toHaveBeenCalledWith("");
  });
});

describe("search: the shop without a search is the shop as it was", () => {
  it("no words and no facets: the same grid, card for card", () => {
    const v = createInitialVector();
    for (const sort of ["popular", "match"] as const)
      for (const [tee, cats] of [[null, []], ["black", []], [null, ["photographs"]]] as const) {
        const ranked = rankShirts(v, SHIRTS, sort, { rotate: "x" });
        // Before search, ShopView computed this.
        const filtered = dedupeByFamily(filterShop(ranked, { tee, cats: [...cats] }));
        const kept = sort === "popular" && !cats.length ? filtered.filter(({ shirt }) => shirt.rank < SHOP_WINDOW) : [];
        const before = [...kept, ...diversify(filtered.slice(kept.length), { category: cats.length !== 1, color: !tee, wildcardEvery: sort === "match" ? 8 : 0 })];
        expect(shopList({ ranked, tee, cats: [...cats], sort, result: null }).map((x) => x.shirt.id)).toEqual(before.map((x) => x.shirt.id));
      }
  });

  it("facets alone narrow that same order", () => {
    const ranked = rankShirts(createInitialVector(), SHIRTS, "popular");
    const medium = index.file.tables.medium[0].id;
    const result = mod.search(index, SHIRTS, { query: "", facets: [{ kind: "medium", value: medium }], order: ranked });
    const list = shopList({ ranked, tee: null, cats: [], sort: "popular", result });
    expect(list.every((x) => x.shirt.medium === medium)).toBe(true);
    expect(list.length).toBe(dedupeByFamily(ranked.filter((r) => r.shirt.medium === medium)).length);
  });
});
