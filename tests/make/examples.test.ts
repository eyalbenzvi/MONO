import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MADE } from "@/lib/custom/products";
import { drawSpec } from "./render";

const SNAP = path.join(__dirname, "examples.snap.json");
/** The products whose example prints are pinned: every product as it shipped before the print fonts and editable captions. */
const pinned = JSON.parse(readFileSync(SNAP, "utf8")) as Record<string, string>;
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

describe("Make: the shipped examples stay byte for byte", () => {
  it("every pinned product's example draws exactly as before, on both tees", async () => {
    const now: Record<string, string> = {};
    for (const m of MADE) for (const color of ["black", "white"] as const) now[`${m.slug}/${color}`] = sha(await drawSpec(m.example, color));
    // Regenerate by hand only when a print is meant to change: UPDATE_EXAMPLES=1 npx vitest run tests/make/examples.test.ts
    if (process.env.UPDATE_EXAMPLES) writeFileSync(SNAP, JSON.stringify(Object.fromEntries(Object.entries(now).filter(([k]) => k in pinned || process.env.UPDATE_EXAMPLES === "all")), null, 2) + "\n");
    for (const [k, v] of Object.entries(pinned)) expect(now[k], k).toBe(v);
  }, 300_000);
});
