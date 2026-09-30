import { describe, expect, it } from "vitest";
import { analyseVoice, simpleRatio } from "@/lib/custom/voice";
import { mulberry32 } from "../scripts/gen/core";

const SR = 44100;
const tone = (parts: [number, number][], seconds = 3, fade = 0) => {
  const x = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [f, amp] of parts) v += amp * Math.sin(2 * Math.PI * f * t);
    x[i] = v * Math.exp(-fade * t) * 0.5;
  }
  return x;
};

describe("Your Voice: the numbers from three seconds of sound", () => {
  it("a sine at 110, 220 and 440 Hz: the pitch within 2%", () => {
    for (const f of [110, 220, 440]) {
      const r = analyseVoice(tone([[f, 1]]), SR);
      expect(r, String(f)).not.toBeNull();
      expect(Math.abs(r!.f - f) / f, String(f)).toBeLessThan(0.02);
    }
  });
  it("two tones a fifth apart (200 and 300 Hz): the ratio is 3:2", () => {
    const r = analyseVoice(tone([[200, 1], [300, 0.9]]), SR)!;
    expect([r.a, r.b]).toEqual([3, 2]);
  });
  it("a voice-like tone with overtones: the strongest two partials give the ratio", () => {
    const r = analyseVoice(tone([[196, 0.5], [392, 1], [588, 0.7], [784, 0.2]]), SR)!;
    expect(Math.abs(r.f - 196) / 196).toBeLessThan(0.02);
    expect([r.a, r.b]).toEqual([3, 2]);
  });
  it("a pure tone has no second partial: the octave, 2:1", () => {
    const r = analyseVoice(tone([[220, 1]]), SR)!;
    expect([r.a, r.b]).toEqual([2, 1]);
  });
  it("silence and noise: didn't catch a note", () => {
    expect(analyseVoice(new Float32Array(SR * 3), SR)).toBeNull();
    const rnd = mulberry32(7);
    const noise = new Float32Array(SR * 3).map(() => (rnd() - 0.5) * 0.8);
    expect(analyseVoice(noise, SR)).toBeNull();
    expect(analyseVoice(new Float32Array(100), SR)).toBeNull();
  });
  it("a fading note damps more than a held one; every number is in the spec's range", () => {
    const held = analyseVoice(tone([[220, 1], [440, 0.5]]), SR)!;
    const fading = analyseVoice(tone([[220, 1], [440, 0.5]], 3, 1.5), SR)!;
    expect(fading.d).toBeGreaterThan(held.d);
    for (const r of [held, fading]) {
      expect(r.d).toBeGreaterThanOrEqual(0.003);
      expect(r.d).toBeLessThanOrEqual(0.03);
      expect(r.ph).toBeGreaterThanOrEqual(0);
      expect(r.ph).toBeLessThanOrEqual(6.28);
      expect(r.a).toBeLessThanOrEqual(7);
      expect(r.b).toBeLessThanOrEqual(7);
    }
  });
  it("simple ratios: nearest fraction with terms ≤ 7", () => {
    expect(simpleRatio(1.5)).toEqual([3, 2]);
    expect(simpleRatio(2)).toEqual([2, 1]);
    expect(simpleRatio(1.3333)).toEqual([4, 3]);
    expect(simpleRatio(8)).toEqual([7, 1]);
  });
});
