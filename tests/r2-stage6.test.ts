import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { productRedirectScript } from "@/lib/notFound";
import { ICONS } from "@/lib/icons";

const ROOT = path.resolve(__dirname, "..");

/** Run the 404 script against a fake location; returns where it sent the page (or null). */
function run(script: string, href: string) {
  const u = new URL(href);
  let to: string | null = null;
  const location = { pathname: u.pathname, search: u.search, hash: u.hash, replace: (x: string) => (to = x) };
  new Function("location", script)(location);
  return to;
}

describe("R23: the 404 sends designs without a static page to the client route", () => {
  it("under /MONO, with query and hash kept; other paths stay", () => {
    const s = productRedirectScript("/MONO", 2800);
    expect(run(s, "https://x.io/MONO/shop/mono-2400/")).toBe("/MONO/shop/p/?id=mono-2400");
    expect(run(s, "https://x.io/MONO/shop/mono-2400/?c=white&ref=x#variations")).toBe("/MONO/shop/p/?id=mono-2400&c=white&ref=x#variations");
    expect(run(s, "https://x.io/MONO/shop/mono-9999/")).toBeNull();
    expect(run(s, "https://x.io/MONO/shop/nope/")).toBeNull();
    expect(run(s, "https://x.io/MONO/cart/x")).toBeNull();
    expect(run(productRedirectScript("", 2800), "https://x.io/shop/mono-0001")).toBe("/shop/p/?id=mono-0001");
  });
});

describe("R23: shared SVG files match their sources", () => {
  it("icons.svg and the tee layers are what `npm run sprites` writes", async () => {
    const { iconSprite, teeLayers } = await import("../scripts/tools/sprites");
    expect(readFileSync(path.join(ROOT, "public", "icons.svg"), "utf8")).toBe(iconSprite());
    for (const [name, svg] of Object.entries(teeLayers())) expect(readFileSync(path.join(ROOT, "public", "tee", `${name}.svg`), "utf8"), name).toBe(svg);
    for (const id of Object.keys(ICONS)) expect(iconSprite()).toContain(`<symbol id="${id}"`);
  });
});

describe("I03: the index is published as hashed static JSON", () => {
  it("public/data/<manifest file> is data/shirts.index.json, named by its hash", async () => {
    const { publishedIndex } = await import("../scripts/tools/publishIndex");
    const manifest = JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.index.manifest.json"), "utf8"));
    const { json, file } = publishedIndex();
    expect(manifest.file).toBe(file);
    expect(readFileSync(path.join(ROOT, "public", "data", file), "utf8")).toBe(json);
    expect(JSON.parse(json)).toEqual(JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.index.json"), "utf8")));
  });

  it("the browser bundle's catalog module doesn't import the index", () => {
    const src = readFileSync(path.join(ROOT, "lib", "catalog.ts"), "utf8");
    expect(src).not.toMatch(/from "@\/data\/shirts\.index\.json"/);
    const loader = readFileSync(path.join(ROOT, "lib", "catalogIndex.ts"), "utf8");
    expect(loader).toMatch(/typeof window === "undefined"\) return require\("@\/data\/shirts\.index\.json"\)/);
  });
});
