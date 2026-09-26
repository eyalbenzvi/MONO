// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MeView } from "@/components/MeView";
import { Header } from "@/components/Header";
import { CALIBRATION_IDS, SHIRTS } from "@/lib/catalog";
import { useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";

afterEach(cleanup);
// jsdom has no ResizeObserver (the header measures itself).
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
beforeEach(() => {
  localStorage.clear();
  act(() => {
    useUiStore.setState({ hydrated: true });
    useTasteStore.getState().reset();
    useCartStore.setState({ cart: [], lastOrder: null, preferredSize: null });
  });
});

describe("U1: a minimal header", () => {
  it("the logo, the tabs and the person icon; the bag only while it holds something", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "You: taste, saved, orders" }).getAttribute("href")).toMatch(/^\/me\/?$/);
    expect(screen.queryByRole("link", { name: /^Bag/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Saved/ })).toBeNull();
    act(() => void useCartStore.getState().addToCart(SHIRTS[0].id, "M", undefined, 1, { silent: true }));
    expect(screen.getByRole("link", { name: /^Bag \(1\)/ })).toBeTruthy();
  });
});

describe("U2: the personal area", () => {
  it("before the taste test it invites one; after it, the taste set like About, real counts, picks, Saved and the quiet actions", () => {
    const { rerender, container } = render(<MeView />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Notyet.");
    expect(screen.getByRole("link", { name: "Start swiping" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset taste" })).toBeNull();
    act(() => useTasteStore.setState({ seen: [...CALIBRATION_IDS], likedIds: [...CALIBRATION_IDS.slice(0, 2), SHIRTS[5].id], dislikedIds: CALIBRATION_IDS.slice(2, 5) }));
    rerender(<MeView />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/Not/);
    // Counts from the store: rated, saved, in bag.
    const counts = [...container.querySelectorAll("dl dd.font-mono")].map((d) => d.textContent);
    expect(counts).toEqual([String(CALIBRATION_IDS.length), "3", "0"]);
    expect(screen.getByRole("list", { name: "Picked for you" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit saved" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share my taste" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset taste" })).toBeTruthy();
    // No decoration that looks like data, no nags.
    expect(screen.queryByText(/Keep swiping|streak|learned from/)).toBeNull();
  });

  it("W2: too few likes (after the test, or after unsaving) — not enough to know the taste: no archetype, no picks, Saved still editable", () => {
    act(() => useTasteStore.setState({ seen: [...CALIBRATION_IDS], likedIds: [CALIBRATION_IDS[0], CALIBRATION_IDS[1]], dislikedIds: CALIBRATION_IDS.slice(2) }));
    render(<MeView />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Notenough.");
    expect(screen.getByRole("button", { name: /Not enough to know your taste yet: 1 more like\./ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Keep swiping" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Picked for you" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Share my taste" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit saved" })).toBeTruthy();
  });

  it("Clear data asks for a second tap", () => {
    render(<MeView />);
    const clear = screen.getByRole("button", { name: "Clear data" });
    act(() => clear.click());
    expect(screen.getByRole("button", { name: "Tap again" })).toBeTruthy();
  });
});
