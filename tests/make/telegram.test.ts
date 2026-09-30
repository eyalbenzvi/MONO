import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/telegram";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { PRODUCT, TELEGRAM_MAX, TELEGRAM_NAME_MAX, check, telegramFit, telegramWords } from "@/lib/custom/specs/telegram";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const spec = (p: Record<string, unknown>) => validate({ t: "telegram", v: 1, p });
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline| transform=|NaN/;

describe("Your Telegram: the spec", () => {
  it("accepts the example and drops unknown keys", () => {
    expect(check(PRODUCT.example as unknown as Record<string, unknown>, {})).toEqual(PRODUCT.example);
    expect(spec({ to: "Noa", m: "Hello.", z: 1 })!.p).toEqual({ to: "Noa", m: "Hello." });
  });
  it("refuses a missing or untidy name, a bad day, a message too long or unprintable", () => {
    for (const p of [{}, { m: "Hi" }, { to: "Noa" }, { to: " Noa", m: "Hi" }, { to: "Noa", m: "" }, { to: "Noa", m: "Hi", d: "2019-02-30" }, { to: "Noa", m: "Hi", fr: "" }, { to: "x".repeat(TELEGRAM_NAME_MAX + 1), m: "Hi" }, { to: "Noa", m: "x".repeat(TELEGRAM_MAX + 1) }, { to: "Noa", m: "שלום" }, { to: "Noa", m: "a<b" }])
      expect(spec(p), JSON.stringify(p)).toBeNull();
    // A word wider than a strip can't be set: refused, not drawn small (every full stop as STOP still fits).
    expect(telegramFit("W".repeat(60))).toBeNull();
    expect(spec({ to: "Noa", m: "W".repeat(60) })).toBeNull();
    expect(telegramFit("a. ".repeat(53).trim())).not.toBeNull();
  });
  it("sets the message as a clerk would", () => {
    expect(telegramWords("Arrived. Miss you... Home soon.")).toBe("ARRIVED STOP MISS YOU STOP HOME SOON STOP");
    expect(telegramWords("3.5 kg")).toBe("3.5 KG");
  });
  it("the longest link fits", () => {
    // The message in two-byte letters, as words (one 160-letter word can't be set on the strips, so no link carries one).
    const longest = spec({ to: "Ã".repeat(TELEGRAM_NAME_MAX), fr: "Ã".repeat(TELEGRAM_NAME_MAX), d: "2019-06-02", m: "ÃÃÃÃÃÃÃ ".repeat(20).slice(0, TELEGRAM_MAX).trim() });
    expect(longest).not.toBeNull();
    const n = encodeMake(longest!).length;
    // 596 at its longest, over the 300 a product keeps to: a telegram is its 160-character message (and a letter
    // outside ASCII takes two bytes in the link). Bounded at 640; with the caption's 160 more, within the 1,200 ?make= reads.
    expect(n).toBeLessThan(640);
    expect(n + 160).toBeLessThanOrEqual(1200);
    console.log(`telegram: longest ?make= ${n} characters`);
  });
});

describe("Your Telegram: the template", () => {
  it("is deterministic and draws only what the preview can", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    const a = render(s, "black");
    expect(a).toBe(render(s, "black"));
    expect(a).not.toMatch(FORBIDDEN);
  });
  it("the example passes the gate in both colours", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    for (const color of ["black", "white"] as const) expect(gate(render(s, color), color)).toBeNull();
  });
  it("fuzz: one word to the longest, full stops everywhere, every field or none: all pass the gate", () => {
    const rnd = mulberry32(0x7e1e);
    const words = ["arrived", "safely", "weather", "fair", "home", "Tuesday", "love", "Mum", "stop", "3.5", "kg", "WWWW", "on", "a", "the", "train", "O'Neill", "&", "noon"];
    const msgs = ["Hi", "W", "W".repeat(TELEGRAM_MAX), "Yes.", `${"WWWWWWWWW ".repeat(16).trim()}`, "a. ".repeat(40).trim()];
    for (let i = 0; i < 40; i++) {
      let m = "";
      while (m.length < 4 + rnd() * (TELEGRAM_MAX - 10)) m += (m ? " " : "") + words[Math.floor(rnd() * words.length)] + (rnd() < 0.2 ? "." : "");
      msgs.push(m.slice(0, TELEGRAM_MAX).trim());
    }
    const failures: string[] = [];
    msgs.forEach((m, i) => {
      const p = { to: i % 3 ? "Noa" : "W".repeat(TELEGRAM_NAME_MAX), ...(i % 2 ? { fr: "W".repeat(TELEGRAM_NAME_MAX) } : {}), ...(i % 5 ? { d: "2019-12-28" } : {}), m };
      const s = spec(p) as CustomSpec | null;
      if (!s) {
        // Only a message too long once set may be refused.
        expect(telegramFit(m), m).toBeNull();
        return;
      }
      for (const color of i % 4 ? (["black"] as const) : (["black", "white"] as const)) {
        const bad = gate(render(s, color), color);
        if (bad) failures.push(`${m} ${color}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
