import { describe, expect, it } from "vitest";
import { decide, type Listed, type Review, type Verdict } from "../scripts/studio/approve";
import { APPROVE_AVERAGE, UNGATED_RUNS, approvalOf, folders, gatedCategory, gatedTees, tooSmall } from "../scripts/studio/publish";

const listed = (family: string[]): Listed[] => family.map((f, i) => ({ no: i + 1, folder: `0${i + 1}-1-d${i + 1}`, title: `D${i + 1}`, family: f }));
/** Five reviews giving each design the scores in `scores[i]` and the verdicts in `verdicts[i]`. */
function reviews(scores: number[][], verdicts: Verdict[][]): Review[] {
  return [0, 1, 2, 3, 4].map((k) => ({
    designer: `Designer ${k + 1}`,
    designs: scores.map((s, i) => ({ no: i + 1, score: s[k], verdict: verdicts[i][k] })),
  }));
}
const PASS5: Verdict[] = ["PASS", "PASS", "PASS", "PASS", "PASS"];

describe("studio gate: the designers' decision", () => {
  it("approves at an average of 7 or more with fewer than three DELETE votes", () => {
    const d = decide(listed(["animals", "animals", "streets"]), reviews([[8, 7, 7, 7, 7], [7, 7, 7, 6, 6], [9, 9, 9, 9, 9]], [PASS5, PASS5, ["DELETE", "DELETE", "DELETE", "PASS", "PASS"]]));
    expect(d["01-1-d1"]).toMatchObject({ average: 7.2, approved: true });
    expect(d["02-1-d2"]).toMatchObject({ average: 6.6, approved: false });
    expect(d["03-1-d3"]).toMatchObject({ deleteVotes: 3, approved: false });
    expect(APPROVE_AVERAGE).toBe(7);
  });

  it("keeps the two best of a family in a run", () => {
    const d = decide(listed(["streets", "streets", "streets", "animals"]), reviews([[7, 7, 7, 7, 7], [8, 8, 8, 8, 8], [9, 9, 9, 9, 9], [7, 7, 7, 7, 7]], [PASS5, PASS5, PASS5, PASS5]));
    expect(Object.entries(d).filter(([, v]) => v.approved).map(([k]) => k)).toEqual(["02-1-d2", "03-1-d3", "04-1-d4"]);
    expect(d["01-1-d1"].why).toMatch(/third streets/);
  });

  it("--max keeps the run's best N of the approved", () => {
    const d = decide(listed(["a", "b", "c"]), reviews([[7, 7, 7, 7, 7], [9, 9, 9, 9, 9], [8, 8, 8, 8, 8]], [PASS5, PASS5, PASS5]), 2);
    expect(Object.entries(d).filter(([, v]) => v.approved).map(([k]) => k)).toEqual(["02-1-d2", "03-1-d3"]);
    expect(d["01-1-d1"].why).toMatch(/2 best/);
  });

  it("needs all five reviews, each with a verdict for every design", () => {
    expect(() => decide(listed(["animals"]), reviews([[7, 7, 7, 7, 7]], [PASS5]).slice(0, 4))).toThrow(/five designers/);
    const r = reviews([[7, 7, 7, 7, 7], [7, 7, 7, 7, 7]], [PASS5, PASS5]);
    r[2].designs.pop();
    expect(() => decide(listed(["a", "b"]), r)).toThrow(/no verdict for #2/);
  });
});

describe("studio gate: what the shop makes of an approved design", () => {
  it("an outline drawing prints on both tees (dense ink leads with white); anything shaded on white alone", () => {
    expect(gatedTees({ blackTee: true, coverage: 0.1 })).toEqual({ baseColor: "black", single: false });
    expect(gatedTees({ blackTee: true, coverage: 0.2 })).toEqual({ baseColor: "white", single: false });
    expect(gatedTees({ blackTee: false, coverage: 0.1 })).toEqual({ baseColor: "white", single: true });
  });

  it("files a design by its Category line (a shop label or key)", () => {
    expect(gatedCategory("Architecture")).toBe("architecture");
    expect(gatedCategory("Botanical & Nature")).toBe("specimens");
    expect(gatedCategory("Engravings")).toBe("etched");
    expect(gatedCategory("sky")).toBe("sky");
    expect(gatedCategory("whatever")).toBe("specimens");
  });

  it("a print under 20 cm wide and 30 cm tall is too small to sell; a tall or a wide one isn't", () => {
    expect(tooSmall([15, 25])).toBe(true);
    expect(tooSmall([8, 33])).toBe(false);
    expect(tooSmall([26, 12])).toBe(false);
  });

  it("the runs before the gate are published as they were: every one of their folders, none filtered", () => {
    const list = folders();
    for (const run of UNGATED_RUNS) expect(list.some((d) => d.includes(`/${run}/`))).toBe(true);
    // A gated run's folder is published only when its decision approved it.
    for (const d of list.filter((d) => !/data\/studio\/(\d{2}-|run50\/|run50b\/|sdxl50\/)/.test(d))) {
      const run = d.split("/").at(-2)!;
      expect(approvalOf(run)?.designs[d.split("/").at(-1)!]?.approved, d).toBe(true);
    }
  });
});
