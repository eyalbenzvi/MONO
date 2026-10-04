// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";

// next/link needs the app router; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, replace: _r, scroll: _s, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; replace?: boolean; scroll?: boolean; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The sheets' history steps need a router; these tests only render them.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, back() {} }), usePathname: () => "/" }));

import { ProductCard } from "@/components/shop/ProductCard";
import { MiniBag } from "@/components/shop/MiniBag";
import { TasteSheet } from "@/components/TasteSheet";
import { getShirtById } from "@/lib/catalog";
import { useCartStore } from "@/store/cartStore";
import { useUiStore } from "@/store/useUiStore";
import { W1 } from "./fixtures";

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

const shirt = getShirtById(W1)!;

describe("ProductCard", () => {
  it("one link with the name (no price anywhere on a card) and a heart named for the tee — no quick add, share or match badge", () => {
    const { container } = render(<ProductCard shirt={shirt} variations={1} />);
    const link = screen.getByRole("link", { name: new RegExp(`^${shirt.title}`) });
    expect(link.getAttribute("href")).toBe(`/shop/${shirt.id}/`);
    // Singular and plural (never "1 variations").
    expect(link.getAttribute("aria-label")).toBe(`${shirt.title}, 1 variation`);
    expect(link.className).toMatch(/line-clamp-2/);
    expect(container.textContent).not.toMatch(/\$\d/);
    expect(screen.getByRole("button", { name: `Save ${shirt.title}` })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Share / })).toBeNull();
    expect(screen.queryByText(/match/i)).toBeNull();
  });

  it("Top pick shows on the first card of your edit, quietly; New this week isn't shown", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(shirt.dropDate + 86_400_000);
    const { rerender, container } = render(<ProductCard shirt={shirt} />);
    expect(container.textContent).not.toMatch(/New this week|Top pick/);
    rerender(<ProductCard shirt={shirt} topPick />);
    expect(screen.getByText("Top pick")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Top pick/ })).toBeTruthy();
  });
});

describe("MiniBag", () => {
  it("confirms an add at the bottom, naming the tee — '✓ Added: <title>', 'Black · M' — and Checkout (to the delivery form), no other buttons", () => {
    render(<MiniBag />);
    act(() => void useCartStore.getState().addToCart(shirt.id, "M", "black", 1, { source: "grid" }));
    const region = screen.getByRole("region", { name: "Added to bag" });
    expect(region.textContent).toContain(`Added: ${shirt.title}`);
    expect(region.textContent).toContain("Black · M");
    const checkout = screen.getByRole("link", { name: "Checkout" });
    expect(checkout.getAttribute("href")).toBe("/cart/");
    act(() => checkout.click());
    expect(useUiStore.getState().checkoutRequested).toBe(true);
    useUiStore.getState().requestCheckout(false);
    expect(region.querySelectorAll("button")).toHaveLength(0);
  });

  it("leaves by itself after 5 s", () => {
    vi.useFakeTimers();
    render(<MiniBag />);
    act(() => void useCartStore.getState().addToCart(shirt.id, "M", "black"));
    expect(screen.queryByRole("region", { name: "Added to bag" })).not.toBeNull();
    act(() => void vi.advanceTimersByTime(4000));
    expect(useUiStore.getState().added).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1100));
    expect(useUiStore.getState().added).toBeNull();
  });
});

describe("TasteSheet", () => {
  it("the taste in words (archetype, sentence, traits), Share as a text link and one way on — no levels, bars, Daily 5, reset or percentages", () => {
    render(<TasteSheet open onClose={() => {}} />);
    const sheet = screen.getByRole("dialog", { name: "Your taste" });
    expect(screen.queryAllByRole("meter")).toHaveLength(0);
    expect(sheet.textContent).not.toMatch(/Sharpening|Focused|Dialled in|Daily 5|streak/);
    expect(screen.getByRole("button", { name: "Share your taste" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "See your edit" }).getAttribute("href")).toBe("/shop/");
    expect(screen.queryByRole("button", { name: /Reset taste/ })).toBeNull();
    expect(sheet.textContent).not.toMatch(/\d+%/);
  });
});
