/**
 * The tests every later Make product has (modelled on snowflake.test.ts): the
 * spec takes the example and drops unknown keys, refuses what it must, keeps
 * its longest link short; the template is deterministic and draws only what
 * the preview can; the example and a fuzz over the whole input range pass the
 * gate in both colours.
 */
import { describe, expect, it } from "vitest";
import { EXTRA } from "@/lib/custom/specs";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { gate } from "./fuzz";
import { drawSpec } from "./render";

export const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline|NaN/;
/** A transform only as arcText's rotated letters (kit arcText), never on a drawing. */
const STRAY_TRANSFORM = /<(?!g )[a-z]+ [^>]*transform=/;

export interface Suite {
  slug: string;
  /** Params that must be refused (each alone). */
  refuse: Record<string, unknown>[];
  /** The longest params the product takes. */
  longest: Record<string, unknown>;
  /** The link's bound: 300 unless justified here. */
  linkMax?: number;
  /** Params over the whole range: each must be valid and pass the gate (every fourth in both colours). */
  fuzz: Record<string, unknown>[];
  /** Params that may be refused in the fuzz, and why (the editor says so): a predicate that's true when refusing is right. */
  mayRefuse?: (p: Record<string, unknown>) => boolean;
}

export const specOf = (slug: string, p: Record<string, unknown>) => validate({ t: slug, v: 1, p }) as CustomSpec | null;

export function productSuite(s: Suite) {
  const m = (EXTRA as unknown as Record<string, { check: (p: Record<string, unknown>, c: object) => unknown; PRODUCT: { example: Record<string, unknown> }; NAME: string }>)[s.slug];
  const example = m.PRODUCT.example;
  describe(`${m.NAME}: the spec`, () => {
    it("accepts the example as it is, and drops unknown keys", () => {
      expect(m.check(example, {})).toEqual(example);
      expect(specOf(s.slug, { ...example, zz: 1 })!.p).toEqual(example);
    });
    it("refuses what it must", () => {
      for (const p of s.refuse) expect(specOf(s.slug, p), JSON.stringify(p)).toBeNull();
    });
    it("the longest link fits", () => {
      const spec = specOf(s.slug, s.longest);
      expect(spec, JSON.stringify(s.longest)).not.toBeNull();
      const n = encodeMake(spec!).length;
      console.log(`${s.slug}: longest ?make= ${n} characters`);
      expect(n).toBeLessThan(s.linkMax ?? 300);
      // Whatever the bound, a link ?make= can't read is no link: with the caption at its longest (up to 160 more) it stays within decodeMake's 1,200.
      expect(n + 160).toBeLessThanOrEqual(1200);
    });
  });
  describe(`${m.NAME}: the template`, () => {
    it("is deterministic and draws only what the preview can", async () => {
      const spec = specOf(s.slug, example)!;
      const a = await drawSpec(spec, "black");
      expect(a).toBe(await drawSpec(spec, "black"));
      expect(a).not.toMatch(FORBIDDEN);
      expect(a).not.toMatch(STRAY_TRANSFORM);
    });
    it("the example passes the gate in both colours", async () => {
      const spec = specOf(s.slug, example)!;
      for (const color of ["black", "white"] as const) expect(gate(await drawSpec(spec, color), color)).toBeNull();
    });
    it("fuzz: the whole range passes the gate", async () => {
      const failures: string[] = [];
      for (let i = 0; i < s.fuzz.length; i++) {
        const p = s.fuzz[i];
        const spec = specOf(s.slug, p);
        if (!spec) {
          if (!s.mayRefuse?.(p)) failures.push(`refused: ${JSON.stringify(p)}`);
          continue;
        }
        for (const color of i % 4 ? (["black"] as const) : (["black", "white"] as const)) {
          const bad = gate(await drawSpec(spec, color), color);
          if (bad) failures.push(`${JSON.stringify(p)} ${color}: ${bad}`);
        }
      }
      expect(failures.slice(0, 5)).toEqual([]);
    }, 900_000);
  });
}
