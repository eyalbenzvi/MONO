import { describe, expect, it } from "vitest";
import { teeBalance } from "../scripts/studio/teeBalance";

describe("tee balance (studio build process)", () => {
  it("counts both-tee leads and one-tee groups, and names the tee that is behind", () => {
    const rows = [
      { colors: ["black", "white"], baseColor: "white" },
      { colors: ["black", "white"], baseColor: "white" },
      { colors: ["black", "white"], baseColor: "black" },
      { colors: ["white"], baseColor: "white" },
      { colors: ["white"], baseColor: "white" },
      { colors: ["black"], baseColor: "black" },
    ];
    expect(teeBalance(rows)).toEqual({ total: 6, both: 3, leadWhite: 2, leadBlack: 1, whiteOnly: 2, blackOnly: 1, nextDefault: "black", singleWanted: "black" });
  });
  it("leads with white on a tie", () => {
    expect(teeBalance([{ colors: ["black", "white"], baseColor: "black" }, { colors: ["black", "white"], baseColor: "white" }]).nextDefault).toBe("white");
  });
});
