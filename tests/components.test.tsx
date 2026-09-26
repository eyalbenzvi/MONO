// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";

// next/link needs the app router; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, replace: _r, scroll: _s, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; replace?: boolean; scroll?: boolean; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ProductCard } from "@/components/shop/ProductCard";
import { MiniBag } from "@/components/shop/MiniBag";
import { TasteSheet } from "@/components/TasteSheet";
import { getShirtById } from "@/lib/catalog";
import { useCartStore } from "@/store/cartStore";
import { useUiStore } from "@/store/useUiStore";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => {
  localStorage.clear();
  useUiStore.setState({ hydrated: true, added: null, toast: null });
  useCartStore.setState({ cart: [], preferredSize: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const shirt = getShirtById("mono-0001")!;

describe("ProductCard", () => {
  it("one link with the name (no price: every tee costs the same); heart and quick add; no share, no match badge", () => {
    const { container } = render(<ProductCard shirt={shirt} />);
    expect(screen.getByRole("link", { name: new RegExp(`^${shirt.title}`) }).getAttribute("href")).toBe(`/shop/${shirt.id}/`);
    expect(container.textContent).not.toMatch(/\$\d/);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: `Quick add ${shirt.title}` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Share / })).toBeNull();
    expect(screen.queryByText(/match/i)).toBeNull();
  });

  it("at most one tag: Top pick wins over New this week", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(shirt.dropDate + 86_400_000);
    const { rerender } = render(<ProductCard shirt={shirt} />);
    expect(screen.getByText("New this week")).toBeTruthy();
    rerender(<ProductCard shirt={shirt} topPick />);
    expect(screen.getByText("Top pick")).toBeTruthy();
    expect(screen.queryByText("New this week")).toBeNull();
  });
});

describe("MiniBag", () => {
  it("confirms an add in one row, and Undo takes exactly that add back", () => {
    render(<MiniBag />);
    act(() => void useCartStore.getState().addToCart(shirt.id, "M", "black", 1, { source: "grid" }));
    const region = screen.getByRole("region", { name: "Added to bag" });
    expect(region.textContent).toContain("Added · M");
    expect(screen.getByRole("link", { name: "View bag" }).getAttribute("href")).toBe("/cart/");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(useCartStore.getState().cart).toEqual([]);
  });

  it("leaves by itself after 2.5 s", () => {
    vi.useFakeTimers();
    render(<MiniBag />);
    act(() => void useCartStore.getState().addToCart(shirt.id, "M", "black"));
    expect(screen.queryByRole("region", { name: "Added to bag" })).not.toBeNull();
    act(() => void vi.advanceTimersByTime(2600));
    expect(useUiStore.getState().added).toBeNull();
  });
});

describe("TasteSheet", () => {
  it("holds the level, five trait bars, Daily 5, Share my taste and Reset — no percentages", () => {
    render(<TasteSheet open onClose={() => {}} />);
    const sheet = screen.getByRole("dialog", { name: "Your taste" });
    expect(screen.getAllByRole("meter")).toHaveLength(5);
    expect(sheet.textContent).toMatch(/Sharpening|Focused|Dialled in/);
    expect(sheet.textContent).toContain("Daily 5");
    expect(screen.getByRole("button", { name: "Share my taste" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset taste" })).toBeTruthy();
    expect(sheet.textContent).not.toMatch(/\d+%/);
  });
});
