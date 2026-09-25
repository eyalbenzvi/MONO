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
