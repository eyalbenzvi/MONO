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
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
beforeEach(() => {
  localStorage.clear();
  act(() => {
    useUiStore.setState({ hydrated: true });
    useTasteStore.getState().reset();
    useCartStore.setState({ cart: [], lastOrder: null, preferredSize: null });
  });
});

describe("U1: a minimal header", () => {
  it("only the wordmark, leading home: no tabs, bag or person icon up top", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "MONO, home" }).getAttribute("href")).toBe("/");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("U2: the personal area", () => {
  it("one page in three parts: Your taste, Saved in full, Orders & settings — no checkout CTA, no picks row", () => {
    const { rerender } = render(<MeView />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("You");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Your taste", "Saved", "Orders & settings"]);
    expect(screen.getByText("Not yet.")).toBeTruthy();
    expect(screen.getByText("Swipe ten tees and we’ll learn it.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start the taste test" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset taste" })).toBeNull();
    expect(screen.getByText("Tap ♥ to save a tee.")).toBeTruthy();
    act(() => useTasteStore.setState({ seen: [...CALIBRATION_IDS], likedIds: [...CALIBRATION_IDS.slice(0, 3), SHIRTS[5].id], dislikedIds: CALIBRATION_IDS.slice(3, 6) }));
    rerender(<MeView />);
    expect(screen.getByRole("button", { name: "Share your taste" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset taste" })).toBeTruthy();
    // Saved in full, one "+" per row, no "Add your top 3" or "Add all".
    const saved = screen.getByRole("list", { name: "Saved" });
    expect(saved.querySelectorAll("li")).toHaveLength(4);
    expect(screen.queryByText(/Add your top|Add all/)).toBeNull();
    expect(screen.queryByText(/Picked for you|Checkout ·/)).toBeNull();
    // No gamification, no tracked caps.
    expect(screen.queryByText(/streak|Daily 5|Sharpening|Focused|Dialled in/)).toBeNull();
    expect(document.querySelector(".uppercase")).toBeNull();
  });

  it("W2: too few likes (after the test, or after unsaving): the words of the strip, and Saved still there", () => {
    act(() => useTasteStore.setState({ seen: [...CALIBRATION_IDS], likedIds: [CALIBRATION_IDS[0], CALIBRATION_IDS[1]], dislikedIds: CALIBRATION_IDS.slice(2) }));
    render(<MeView />);
    expect(screen.getByText("Almost there. Keep 1 you’d wear.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Keep swiping" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Share your taste" })).toBeNull();
    expect(screen.getByRole("list", { name: "Saved" })).toBeTruthy();
  });

  it("Clear data asks for a second tap", () => {
    render(<MeView />);
    const clear = screen.getByRole("button", { name: "Clear data" });
    act(() => clear.click());
    expect(screen.getByRole("button", { name: "Tap again" })).toBeTruthy();
  });
});
