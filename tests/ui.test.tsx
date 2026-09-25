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

import { ColorSelector } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { track } from "@/lib/analytics";

describe("ColorSelector", () => {
  it("is one radiogroup in every variant, with arrow-key navigation and roving tabindex", () => {
    for (const variant of ["cards", "pills", "dots", "overlay"] as const) {
      const onChange = vi.fn();
      render(<ColorSelector value="black" original="white" onChange={onChange} variant={variant} />);
      const [black, white] = screen.getAllByRole("radio");
      expect(black.getAttribute("aria-checked")).toBe("true");
      expect(black.tabIndex).toBe(0);
      expect(white.tabIndex).toBe(-1);
      expect(white.getAttribute("aria-label")).toBe("White tee (original)");
      fireEvent.keyDown(black, { key: "ArrowRight" });
      expect(onChange).toHaveBeenLastCalledWith("white");
      cleanup();
    }
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
    track("add_to_cart", { id: "mono-0001", size: "M" });
    expect(window.dataLayer[0]).toMatchObject({ event: "add_to_cart", id: "mono-0001", size: "M" });
  });
});
