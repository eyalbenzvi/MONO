// @vitest-environment jsdom
/**
 * Nothing that changes with the catalogue is compiled into the site's scripts
 * (lib/catalogIndex): every catalogue change would rename those scripts, and a
 * returning visitor's phone would wait on the network for them again before the
 * first card (it did: empty frames for seconds after each catalogue push).
 * scripts/tools/postbuild checks the built scripts; this checks the source, and
 * the page script that opens Discover on the right card (lib/firstCard).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { firstCardScript, NEXT_CARD_KEY, OTHER_CARD_ATTR, SWAPPED_ATTR, rememberTopCard, swapCardScript } from "@/lib/firstCard";
import { CALIBRATION_IDS, SHIRTS } from "@/lib/catalog";
import { mockupImage, SIZES } from "@/lib/images";
import { catalogueInScripts, homeFirstCardMissing } from "../scripts/tools/postbuild";

const ROOT = path.resolve(__dirname, "..");

/** Data the app may import: none of it is made from the catalogue. */
const STABLE_DATA: Record<string, string> = {
  "data/models/models.json": "the model photos",
  "data/lexicon/refuse.json": "words refused in personal text",
  "data/dinosaurs/genera.json": "the Marsh plates' genera",
  "data/custom.manifest.json": "Make's cities, sky and airports files",
  // Derived from the catalogue's features, but read only by the upload page and its worker (lazy scripts, no first screen).
  "data/upload/priors.json": "an upload's category means",
};
/** App files that read data on the server (or in scripts) only: never in a browser script. */
const SERVER_ONLY = new Set(["lib/catalogServer.ts", "lib/catalogIndex.node.ts", "lib/custom/makeBases.ts"]);

function sources(dir: string): string[] {
  return (readdirSync(path.join(ROOT, dir), { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts")).map((f) => path.join(dir, f));
}

describe("the app's scripts don't carry the catalogue", () => {
  const files = ["app", "components", "lib", "store", "hooks"].flatMap(sources);

  it("imports only data that doesn't change with the catalogue", () => {
    const bad: string[] = [];
    for (const f of files) {
      if (SERVER_ONLY.has(f)) continue;
      const src = readFileSync(path.join(ROOT, f), "utf8");
      // (A type-only import is erased from the script.)
      for (const m of src.matchAll(/(?:^\s*import\s+(?!type\s)[^;]*?from\s+|import\(\s*)["']((?:@\/|(?:\.\.\/)+)data\/[^"']+\.json)["']/gm)) {
        const target = path.relative(ROOT, m[1].startsWith("@/") ? path.join(ROOT, m[1].slice(2)) : path.resolve(ROOT, path.dirname(f), m[1]));
        if (!(target in STABLE_DATA)) bad.push(`${f} imports ${target}`);
      }
      // A require() of data is for the server's side of the build only, behind `typeof window === "undefined"`.
      for (const line of src.split("\n")) if (/require\(\s*["'][^"']*data\/[^"']+\.json["']\s*\)/.test(line) && !line.includes('typeof window === "undefined"')) bad.push(`${f}: ${line.trim()}`);
    }
    expect(bad).toEqual([]);
  });

  it("server-only data files are imported by no browser code", () => {
    const bad = files.filter((f) => !SERVER_ONLY.has(f) && !f.startsWith("app/")).filter((f) => /from\s+["']@\/lib\/(catalogServer|custom\/makeBases|catalogIndex\.node)["']/.test(readFileSync(path.join(ROOT, f), "utf8")));
    expect(bad).toEqual([]);
  });

  it("postbuild finds a data file's name or a design id in a built script", () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs") as typeof import("node:fs");
    const out = mkdtempSync(path.join(require("node:os").tmpdir(), "mono-out-"));
    mkdirSync(path.join(out, "data"));
    mkdirSync(path.join(out, "_next", "static", "chunks"), { recursive: true });
    writeFileSync(path.join(out, "data", "index.0123456789.json"), "{}");
    writeFileSync(path.join(out, "data", "cities.0123456789.json"), "{}");
    writeFileSync(path.join(out, "_next", "static", "chunks", "a.js"), 'fetch("/data/cities.0123456789.json")');
    expect(catalogueInScripts(out)).toEqual([]);
    writeFileSync(path.join(out, "_next", "static", "chunks", "b.js"), 'fetch("/data/index.0123456789.json");x="mono-0042"');
    expect(catalogueInScripts(out).map(([f, what]) => `${f}: ${what}`)).toEqual([path.join("chunks", "b.js") + ": the name of data/index.0123456789.json", path.join("chunks", "b.js") + ': the design id "mono-0042"']);
  });

  it("postbuild requires the home page's first card with its picture", () => {
    expect(homeFirstCardMissing('<main><div data-first-card="true"><img src="/img/m/1-white-720.webp" data-mockup="true"/></div></main>')).toBeNull();
    expect(homeFirstCardMissing('<main><div data-first-card="true"><div role="img"></div></div></main>')).toMatch(/no picture/);
    expect(homeFirstCardMissing("<main></main>")).toMatch(/no data-first-card/);
  });
});

describe("Discover opens on the right card before any script (lib/firstCard)", () => {
  const first = CALIBRATION_IDS[0];
  const other = SHIRTS.find((s) => s.id !== first)!;
  const run = () => new Function(firstCardScript(first))();
  const preload = () => document.head.querySelector<HTMLLinkElement>('link[rel="preload"][as="image"]');

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(OTHER_CARD_ATTR);
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("a first visit keeps the served card and preloads nothing", () => {
    run();
    expect(document.documentElement.hasAttribute(OTHER_CARD_ATTR)).toBe(false);
    expect(preload()).toBeNull();
  });

  it("a returning visit on another card hides the served one and preloads its own, at the card's size", () => {
    rememberTopCard(other);
    run();
    expect(document.documentElement.hasAttribute(OTHER_CARD_ATTR)).toBe(true);
    expect(preload()?.getAttribute("imagesrcset")).toBe(mockupImage(other, other.baseColor).srcSet);
    expect(preload()?.getAttribute("imagesizes")).toBe(SIZES.card);
    expect(preload()?.getAttribute("fetchpriority")).toBe("high");
  });

  it("a returning visit still on the served card keeps it", () => {
    rememberTopCard(SHIRTS.find((s) => s.id === first)!);
    run();
    expect(document.documentElement.hasAttribute(OTHER_CARD_ATTR)).toBe(false);
  });

  it("saved state with no card kept yet hides the served card (no wrong design flashes), without a preload", () => {
    localStorage.setItem("mono-taste", "{}");
    run();
    expect(document.documentElement.hasAttribute(OTHER_CARD_ATTR)).toBe(true);
    expect(preload()).toBeNull();
  });

  it("the script after the served card puts the kept card's picture in it", () => {
    document.body.innerHTML = '<div data-first-card><img data-mockup src="/img/m/1-white-720.webp" srcset="/img/m/1-white-360.webp 360w"><h2>First</h2></div>';
    const swap = () => new Function(swapCardScript())();
    swap();
    const card = document.querySelector("[data-first-card]")!;
    expect(card.hasAttribute(SWAPPED_ATTR)).toBe(false); // a first visit: untouched
    rememberTopCard(other);
    run();
    swap();
    const { srcSet } = mockupImage(other, other.baseColor);
    expect(card.querySelector("img")!.getAttribute("srcset")).toBe(srcSet);
    expect(card.querySelector("img")!.getAttribute("src")).toBe(srcSet.split(" ")[0]);
    expect(card.hasAttribute(SWAPPED_ATTR)).toBe(true);
    // The name isn't touched (React would redraw the page over a changed text); CSS hides it meanwhile.
    expect(card.querySelector("h2")!.textContent).toBe("First");
  });

  it("an empty deck forgets the card; a broken value is ignored", () => {
    rememberTopCard(other);
    rememberTopCard(null);
    expect(localStorage.getItem(NEXT_CARD_KEY)).toBeNull();
    localStorage.setItem(NEXT_CARD_KEY, "{not json");
    expect(run).not.toThrow();
  });
});
