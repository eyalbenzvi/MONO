import { expect, test, type Page } from "@playwright/test";
import manifest from "../data/shirts.index.manifest.json";
import { hydrated, seed } from "./helpers";
import { B4, W1 } from "../tests/fixtures";

/** Collect CSP violations (and page errors) from the start of every page. */
async function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && problems.push(`console: ${m.text()}`));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp ??= [];
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return async () => [...problems, ...(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []))];
}

test("I04: every page runs under its CSP (script hashes, no 'unsafe-inline' for scripts) without a single violation", async ({ page }) => {
  const problems = await watch(page);
  await seed(page, {}, [{ id: W1, size: "M", color: "black", qty: 1 }]);
  const seen: string[] = [];
  for (const route of ["", "shop/", `shop/${W1}/`, "cart/", `shop/p/?id=${B4}`, "shop/mono-9999/"]) {
    await page.goto(route);
    await page.waitForTimeout(800);
    const meta = await page.evaluate(() => {
      const head = document.head.children;
      const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return { second: head[1] === csp, content: csp?.getAttribute("content") ?? "" };
    });
    expect(meta.second, route).toBe(true);
    const scriptSrc = meta.content.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc, route).not.toContain("unsafe-inline");
    expect(scriptSrc, route).toContain("'sha256-");
    expect(meta.content).not.toContain("frame-ancestors");
    seen.push(...(await problems()));
  }
  // Client-side navigation too.
  await page.goto("shop/");
  await hydrated(page);
  await page.locator('main a[href*="/shop/mono-"]').first().click();
  await page.waitForURL(/\/shop\/mono-\d+\/$/);
  await page.getByRole("link", { name: "Discover" }).click();
  await page.waitForTimeout(800);
  seen.push(...(await problems()));
  expect(seen).toEqual([]);
});

test("R23/I03: icons come from the sprite, mockups are baked pictures, the index from one hashed JSON", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto(`shop/${W1}/`);
  await hydrated(page);
  await page.waitForTimeout(500);
  expect(await page.locator("svg use").count()).toBeGreaterThan(3);
  expect(await page.locator("svg use").first().getAttribute("href")).toMatch(/\/icons\.svg#[\w-]+$/);
  // Mockups are pictures baked at build time (the model photo with the print on it): no photo or print is fetched apart.
  const teeImgs = page.locator("img[data-mockup]");
  expect(await teeImgs.count()).toBeGreaterThanOrEqual(1);
  await expect.poll(() => teeImgs.first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0 && /\/img\/m\//.test(i.currentSrc))).toBe(true);
  expect(requests.filter((p) => /\/(prints|models|tee)\//.test(p))).toEqual([]);
  // No mockup paths inlined in the page any more.
  expect(await page.locator("svg path[d^='M150 24 Q200 36']").count()).toBe(0);
  const indexLoads = requests.filter((p) => p.endsWith(`/data/${manifest.file}`));
  expect(indexLoads).toHaveLength(1);
  expect(await page.locator(`link[rel="preload"][href$="/data/${manifest.file}"]`).count()).toBe(1);
});
