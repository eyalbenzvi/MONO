// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SizeSelector } from "@/components/ui";

afterEach(cleanup);

describe("SizeSelector", () => {
  it("reports the tapped size and marks the selected one", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SizeSelector value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /^M\b/ }));
    expect(onChange).toHaveBeenCalledWith("M");
    rerender(<SizeSelector value="M" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: /^M\b/ }).getAttribute("aria-checked")).toBe("true");
  });
});

import { TeeChoice } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { track } from "@/lib/analytics";
import { W1 } from "./fixtures";

describe("TeeChoice", () => {
  it("one radiogroup: Black · White · Both with the pair's price, arrow keys and roving tabindex, the original marked", () => {
    const onChange = vi.fn();
    render(<TeeChoice value="black" original="white" colors={["black", "white"]} onChange={onChange} />);
    const [black, white, both] = screen.getAllByRole("radio");
    expect(black.getAttribute("aria-checked")).toBe("true");
    expect(black.tabIndex).toBe(0);
    expect(white.tabIndex).toBe(-1);
    expect(white.getAttribute("aria-label")).toBe("White tee (original)");
    expect(both.textContent).toBe("Both · $90");
    fireEvent.keyDown(black, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("white");
    for (const r of [black, white, both]) expect(r.className).toMatch(/\bh-11\b/);
    cleanup();
    render(<TeeChoice value="black" original="black" colors={["black", "white"]} onChange={onChange} pairPrice={130} />);
    expect(screen.getAllByRole("radio")[2].textContent).toBe("Both · $130");
  });
});

describe("formatPrice", () => {
  it("shows whole dollars without cents and anything else with two decimals", () => {
    expect(formatPrice(48)).toBe("$48");
    expect(formatPrice(53.5)).toBe("$53.50");
    expect(formatPrice(0.1 + 0.2)).toBe("$0.30");
  });
});

describe("track", () => {
  it("pushes events onto window.dataLayer", () => {
    window.dataLayer = [];
    track("add_to_cart", { id: W1, size: "M" });
    expect(window.dataLayer[0]).toMatchObject({ event: "add_to_cart", id: W1, size: "M" });
  });
});
