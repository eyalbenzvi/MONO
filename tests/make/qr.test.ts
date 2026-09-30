import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import jsQR from "jsqr";
import { QR_MIN_VERSION, addressLines, render } from "@/lib/custom/templates/qr";
import { encodeQr, formatBits, qrCapacity, rsRemainder, versionBits } from "@/lib/custom/draw/qr";
import { LINK_MAX, PRODUCT, check, linkProblem, linkUrl, tidyLink, type Params } from "@/lib/custom/specs/qr";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "qr", v: 1, p });
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;

/**
 * What a phone sees: the print rendered at `width` px across (600: about
 * 2 px a millimetre of the tee), framed on the code as a camera is (the
 * registration marks and the quiet zone, not the type around it; `whole`
 * keeps the whole print), decoded with jsQR. A black tee's code is light on
 * dark; phone cameras read that inverted code by inverting the picture, and
 * so does this (`raw` leaves it to jsQR's own inversion instead).
 */
function scan(svg: string, color: "black" | "white", width = 600, opts: { whole?: boolean; raw?: boolean } = {}): string | null {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render();
  const k = img.width / 300;
  const [x0, y0, w, h] = (opts.whole ? [0, 0, 300, 400] : [26, 22, 248, 248]).map((v) => Math.round(v * k));
  const all = img.pixels; // a copy on every read: read once
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) px.set(all.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4);
  if (color === "black" && !opts.raw) for (let i = 0; i < px.length; i += 4) (px[i] = 255 - px[i]), (px[i + 1] = 255 - px[i + 1]), (px[i + 2] = 255 - px[i + 2]);
  return jsQR(px, w, h, { inversionAttempts: opts.raw ? "attemptBoth" : "dontInvert" })?.data ?? null;
}

describe("Your Link: the spec", () => {
  it("accepts the example, drops unknown keys, keeps a fixed key order", () => {
    expect(check(PRODUCT.example as never, {})).toEqual(PRODUCT.example);
    expect(ok({ w: "For Noa", h: 1, a: "example.org/for-noa", q: 2 })).toEqual({ t: "qr", v: 1, p: { a: "example.org/for-noa", h: 1, w: "For Noa" } });
    expect(Object.keys(ok({ w: "For Noa", h: 1, a: "example.org" })!.p)).toEqual(["a", "h", "w"]);
    for (const a of ["a.co", "www.example.org", "example.org/For-Noa", "x.example.co.uk/a_b~c?d=1&e=f#top", "example.org/%20x", "example.org?x=1", "example.org#top", "xn--bcher-kva.example", "a-b.c-d.org/(1)*;,+!$'@:"])
      expect(ok({ a })?.p, a).toEqual({ a });
  });
  it("rejects wrong types, ranges, unknown values, non-canonical forms and over-limit inputs", () => {
    for (const p of [
      {},
      { a: 12 },
      { a: "" },
      { a: "abc" },
      { a: "example" },
      { a: "https://example.org" },
      { a: "Example.org" },
      { a: "example.org/" },
      { a: "example.org:8080/x" },
      { a: "me@example.org" },
      { a: "example.org/a b" },
      { a: " example.org" },
      { a: "example.org/é" },
      { a: "example.org/<x>" },
      { a: 'example.org/"x"' },
      { a: "example.org/%2" },
      { a: "example.org/%zz" },
      { a: "-a.org" },
      { a: "a-.org" },
      { a: "a..org" },
      { a: "example.123" },
      { a: "example.org." },
      { a: `example.org/${"x".repeat(LINK_MAX - 11)}` },
      { a: "example.org", h: 0 },
      { a: "example.org", h: true },
      { a: "example.org", w: "" },
      { a: "example.org", w: " For Noa" },
      { a: "example.org", w: "x".repeat(29) },
    ])
      expect(ok(p), JSON.stringify(p)).toBeNull();
    expect(ok({ a: `example.org/${"x".repeat(LINK_MAX - 12)}` })).not.toBeNull();
  });
  it("tidies what's typed the way the spec keeps it, and says what's wrong in one line", () => {
    expect(tidyLink(" HTTPS://Example.ORG/For-Noa ")).toEqual({ a: "example.org/For-Noa", http: false });
    expect(tidyLink("http://example.org/")).toEqual({ a: "example.org", http: true });
    expect(linkProblem("https://example.org/for-noa")).toBeNull();
    expect(linkProblem("")).toMatch(/Add a web address/);
    expect(linkProblem("example.org/a b")).toMatch(/No spaces/);
    expect(linkProblem("example.org/é")).toMatch(/can’t hold "é"/);
    expect(linkProblem("example")).toMatch(/Add the domain/);
    expect(linkProblem("example.org:8080")).toMatch(/port/);
    expect(linkProblem("mailto:me@example.org")).toMatch(/Only web addresses/);
    expect(linkProblem("ftp://example.org")).toMatch(/Only web addresses/);
    expect(linkProblem("me@example.org")).toMatch(/names or passwords/);
    expect(linkProblem("example.org/%zz")).toMatch(/hex/);
    expect(linkProblem(`example.org/${"x".repeat(LINK_MAX)}`)).toMatch(/Up to 100/);
    expect(linkUrl({ a: "example.org", h: 1 })).toBe("http://example.org");
  });
  it("breaks a long address into at most three lines, losing nothing", () => {
    for (const a of ["a.co", "example.org/for-noa", `photos.example.org/${"abcdefghij/".repeat(8)}xy`, `example.org/${"x".repeat(88)}`]) {
      const lines = addressLines(a);
      expect(lines.join("")).toBe(a);
      expect(lines.length).toBeLessThanOrEqual(3);
      expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(46);
    }
  });
});

describe("Your Link: the encoder", () => {
  it("writes the standard's format and version bits and Reed–Solomon codewords", () => {
    // Level Q, mask 0: 011010101011111 (ISO/IEC 18004 table C.1); version 7: 000111110010010100.
    expect(formatBits(0)).toBe(0b011010101011111);
    expect(formatBits(6)).toBe(0b010111011011010);
    expect(formatBits(7)).toBe(0b010101111101101);
    expect(versionBits(7)).toBe(0b000111110010010100);
    // The standard's worked example (1-M "01234567"): data codewords and their 10 EC codewords.
    expect(rsRemainder([16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17], 10)).toEqual([165, 36, 212, 193, 237, 54, 199, 135, 44, 85]);
    expect([1, 4, 8, 10].map(qrCapacity)).toEqual([11, 46, 108, 151]);
  });
  it("encodes every version from 1 to 10, and decodes as a plain square-module code", () => {
    for (let v = 1; v <= 10; v++) {
      const text = `https://example.org/${"v".repeat(Math.max(0, qrCapacity(v) - 20))}`.slice(0, qrCapacity(v));
      const q = encodeQr(text, v)!;
      expect(q.version).toBe(v);
      const k = 4, n = q.size + 8, W = n * k;
      const px = new Uint8ClampedArray(W * W * 4).fill(255);
      for (let y = 0; y < q.size; y++)
        for (let x = 0; x < q.size; x++)
          if (q.dark[y][x])
            for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) px.fill(0, (((y + 4) * k + a) * W + (x + 4) * k + b) * 4, (((y + 4) * k + a) * W + (x + 4) * k + b) * 4 + 3);
      expect(jsQR(px, W, W, { inversionAttempts: "dontInvert" })?.data, `version ${v}`).toBe(text);
    }
    expect(encodeQr("x".repeat(152))).toBeNull();
  }, 60_000);
  it("the longest address fits version 8 at level Q", () => {
    expect(encodeQr(`https://${"x".repeat(LINK_MAX)}`, QR_MIN_VERSION)!.version).toBe(8);
  });
});

describe("Your Link: the template", () => {
  it("is deterministic, and writes only what the canvas draws", () => {
    const spec = ok({ a: "example.org/for-noa", h: 1, w: "For Noa" })!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(FORBIDDEN);
    expect(svg).not.toMatch(/<(?!\/?(svg|rect|circle|line|path|text|g)\b)/);
  });
  it("the example passes the gate and scans on both tees", () => {
    const spec = ok(PRODUCT.example)!;
    for (const c of ["black", "white"] as const) {
      const svg = render(spec, c);
      expect(gate(svg, c)).toBeNull();
      expect(scan(svg, c)).toBe("https://example.org/for-noa");
    }
  }, 60_000);
  it("the longest link fits", () => {
    const len = encodeMake(ok({ a: `example.org/${"%7E".repeat(29)}x`, h: 1, w: "W".repeat(28) })!).length;
    console.log(`qr: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(300);
  });
  it("short and long, every character, words or none: all pass the gate and scan", () => {
    const rnd = mulberry32(0x9e0c);
    const pick = (s: string) => s[Math.floor(rnd() * s.length)];
    const PATH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~/?#@!$&'()*+,;=";
    const HOSTS = ["a.co", "example.org", "www.example.org", "photos.example.co.uk", "my-name.example", "x1.io"];
    const raws: Record<string, unknown>[] = [
      { ...PRODUCT.example },
      { a: "a.co" },
      { a: "a.co", h: 1, w: "W".repeat(28) },
      { a: "example.org", w: "I" },
      { a: `example.org/${"x".repeat(88)}` },
      { a: `example.org/${"W".repeat(88)}`, w: "W".repeat(28) },
      { a: `example.org/${"%7E".repeat(29)}x`, h: 1 },
      { a: `${"a".repeat(63)}.org/${"-".repeat(32)}` },
      { a: `${"abcdefghi.".repeat(9)}org` },
      { a: `example.org/${"/".repeat(88)}` },
      { a: `example.org/${"?&=#".repeat(22)}` },
      { a: `photos.example.org/albums/2026/our-wedding-day-in-the-hills?share=abc123&view=grid&lang=en-GB#top` },
    ];
    // Every version the print uses (4 to 8), by length.
    for (const len of [4, 20, 40, 45, 50, 60, 64, 70, 80, 85, 90, 95, 99, 100]) {
      const host = HOSTS[Math.floor(rnd() * HOSTS.length)];
      let rest = "/";
      while (host.length + rest.length < len) rest += pick(PATH);
      raws.push({ a: len <= host.length ? host : (host + rest).replace(/\/$/, "x"), ...(rnd() < 0.3 ? { h: 1 } : {}) });
    }
    for (let i = 0; i < 70; i++) {
      const host = HOSTS[Math.floor(rnd() * HOSTS.length)];
      const len = host.length + Math.floor(rnd() * (LINK_MAX - host.length + 1));
      let rest = "";
      if (len > host.length + 1) {
        rest = "/";
        while (host.length + rest.length < len) rest += rnd() < 0.08 ? "%2F" : pick(PATH);
      }
      raws.push({ a: (host + rest).slice(0, LINK_MAX).replace(/%.?$/, "x"), ...(rnd() < 0.3 ? { h: 1 } : {}), ...(rnd() < 0.3 ? { w: "Our wedding photos" } : {}) });
    }
    const failures: string[] = [];
    const versions = new Set<number>();
    let [scans, whole, blackRaw, rawOk] = [0, 0, 0, 0];
    raws.forEach((raw, i) => {
      const spec = ok(raw) as CustomSpec;
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const p = spec.p as Params;
      versions.add(encodeQr(linkUrl(p), QR_MIN_VERSION)!.version);
      const colors: ("black" | "white")[] = i % 2 ? ["black"] : ["black", "white"];
      for (const c of colors) {
        const svg = render(spec, c);
        const bad = gate(svg, c);
        if (bad) failures.push(`${JSON.stringify(raw)} ${c}: ${bad}`);
        const read = scan(svg, c, i % 4 === 1 ? 360 : 600);
        if (read !== linkUrl(p)) failures.push(`${JSON.stringify(raw)} ${c}: scanned ${read}`);
        // For the record, not a gate: jsQR on the whole print (type and all) and on the black tee's code uninverted.
        scans++;
        if (scan(svg, c, 600, { whole: true }) === linkUrl(p)) whole++;
        if (c === "black" && (blackRaw++, scan(svg, c, 600, { raw: true })) === linkUrl(p)) rawOk++;
      }
    });
    console.log(`qr: ${raws.length} prints (${scans} renders), versions ${[...versions].sort((a, b) => a - b).join(", ")}; jsQR on the whole print ${whole}/${scans}, black tee left to jsQR's own inversion ${rawOk}/${blackRaw}`);
    expect([...versions].sort()).toEqual([4, 5, 6, 7, 8]);
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
