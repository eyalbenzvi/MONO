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
  it("before the taste test it invites one; after it, it shows the taste, what it learned from, and picks", () => {
    const { rerender } = render(<MeView />);
    expect(screen.getByText("Not learned yet")).toBeTruthy();
    act(() => useTasteStore.setState({ seen: [...CALIBRATION_IDS], likedIds: [SHIRTS[5].id] }));
    rerender(<MeView />);
    expect(screen.queryByText("Not learned yet")).toBeNull();
    expect(screen.getByText(new RegExp(`learned from ${CALIBRATION_IDS.length} tees you rated`))).toBeTruthy();
    expect(screen.getByRole("list", { name: "Picked for you" })).toBeTruthy();
    expect(screen.getByText("Saved · 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Share my taste/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Clear all my data/ })).toBeTruthy();
  });
});
