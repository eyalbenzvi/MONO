import { describe, expect, it } from "vitest";
import { render, codeBody } from "@/lib/custom/templates/code";
import { CODE_CHARS, CODE_MAX, validate, type CodeKind, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const KINDS: CodeKind[] = ["card", "tape", "morse", "braille", "binary"];
/** Every character a code can carry. */
const alphabet = (k: CodeKind) => Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).filter((c) => CODE_CHARS[k].test(c));

describe("Your Name: the template", () => {
  it("is deterministic, and keeps the letters out when secret", () => {
    const spec: CustomSpec = { t: "code", v: 1, p: { x: "NOA", k: "braille" } };
    expect(render(spec, "black")).toBe(render(spec, "black"));
    expect(codeBody({ x: "NOA", k: "binary" })).toContain(">N<");
    expect(codeBody({ x: "NOA", k: "binary", h: 1 })).not.toMatch(/>N<|>NOA</);
    expect(codeBody({ x: "NOA", k: "card", h: 1 })).not.toMatch(/>NOA</);
  });

  it("every code × 300 names (edge characters, one letter, the longest) passes the gate with no text wider than the print", () => {
    const rnd = mulberry32(0xc0de);
    const failures: string[] = [];
    for (const k of KINDS) {
      const chars = alphabet(k);
      const edges = [chars[0], chars[chars.length - 1], chars.join("").slice(0, CODE_MAX), chars[chars.length - 1].repeat(CODE_MAX), "A", "I I", "0"].filter((x) => x.trim());
      const random = Array.from({ length: 300 - edges.length }, () => Array.from({ length: 1 + Math.floor(rnd() * CODE_MAX) }, () => chars[Math.floor(rnd() * chars.length)]).join(""));
      for (const raw of [...edges, ...random]) {
        const x = raw.replace(/\s+/g, " ").trim();
        if (!x) continue;
        const spec = validate({ t: "code", v: 1, p: { x, k, ...(rnd() < 0.3 ? { h: 1 } : {}) } });
        expect(spec, `${k} ${x}`).not.toBeNull();
        const color = rnd() < 0.5 ? "black" : "white";
        const bad = gate(render(spec!, color), color);
        if (bad) failures.push(`${k} "${x}" ${color}: ${bad}`);
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
