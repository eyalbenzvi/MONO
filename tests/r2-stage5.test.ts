import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = path.resolve(__dirname, "..");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("R07: robots and origin under /MONO", () => {
  it("disallowed paths carry the base path", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/MONO");
    vi.resetModules();
    const robots = (await import("@/app/robots")).default();
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rule.disallow).toEqual(["/MONO/cart/", "/MONO/shop/p/"]);
    expect(rule.allow).toBe("/MONO/");
  });

  it("a CI build without NEXT_PUBLIC_SITE_ORIGIN stops; locally it doesn't", () => {
    const load = (env: Record<string, string>) =>
      execFileSync(process.execPath, ["--input-type=module", "-e", "await import('./next.config.mjs')"], { cwd: ROOT, env: { PATH: process.env.PATH ?? "", NODE_ENV: "production", ...env } as NodeJS.ProcessEnv, stdio: "pipe" });
    expect(() => load({ GITHUB_ACTIONS: "true" })).toThrow(/NEXT_PUBLIC_SITE_ORIGIN/);
    expect(() => load({ GITHUB_ACTIONS: "true", NEXT_PUBLIC_SITE_ORIGIN: "https://example.github.io" })).not.toThrow();
    expect(() => load({})).not.toThrow();
  });
});

describe("R22: every page states its URL", () => {
  it("pageMeta sets the canonical and the Open Graph URL (with the site's image)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_ORIGIN", "https://example.github.io");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/MONO");
    vi.resetModules();
    const { pageMeta } = await import("@/lib/seo");
    const m = pageMeta({ path: "/shop/", title: "Shop", description: "d" });
    expect(m.alternates.canonical).toBe("https://example.github.io/MONO/shop/");
    expect(m.openGraph.url).toBe("https://example.github.io/MONO/shop/");
    expect(m.openGraph.images[0].url).toBe("https://example.github.io/MONO/og/default.png");
    expect(pageMeta({ path: "/cart/", title: "Bag", description: "d", index: false }).robots).toEqual({ index: false });
  });
});
