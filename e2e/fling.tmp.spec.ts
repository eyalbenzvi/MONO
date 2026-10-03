// Scratch, not committed: the shop, a hard fling on a throttled phone (the video's 11–13 s), measured.
import { test } from "@playwright/test";
import { seed, hydrated } from "./helpers";

for (const net of [{ name: "4G", latency: 150, down: 9 }, { name: "slow 4G", latency: 300, down: 4 }])
  test(`fling on ${net.name}`, async ({ page, context }) => {
    test.setTimeout(240_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: net.latency, downloadThroughput: (net.down * 1024 * 1024) / 8, uploadThroughput: (2 * 1024 * 1024) / 8 });
    await page.addInitScript(() => {
      (window as any).__long = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as any).__long.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true });
    });
    await seed(page);
    await page.goto("shop/");
    await hydrated(page);
    await page.waitForTimeout(4000);
    await page.evaluate(() => ((window as any).__long = []));
    // Visible cards: total / no picture yet. Sampled every 100 ms while flinging 2 screens a second for 4 s, then until all show.
    const sample = () =>
      page.evaluate(() => {
        const vh = innerHeight;
        const frames = [...document.querySelectorAll("main [role=img]")].filter((f) => {
          const r = f.getBoundingClientRect();
          return r.bottom > 0 && r.top < vh && r.width > 0;
        });
        const empty = frames.filter((f) => {
          const i = f.querySelector("img[data-mockup]") as HTMLImageElement | null;
          return !(i && i.complete && i.naturalWidth);
        }).length;
        return [frames.length, empty];
      });
    const scroll = (dy: number) =>
      page.evaluate((dy) => {
        let el: Element | null = document.querySelector("main [role=img]");
        for (; el; el = el.parentElement) if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) break;
        (el ?? document.scrollingElement)!.scrollBy(0, dy);
      }, dy);
    let emptyFrames = 0, total = 0, worst = 0;
    const t0 = Date.now();
    for (let k = 0; k < 40; k++) {
      await scroll(170);
      await page.waitForTimeout(100);
      const [f, e] = await sample();
      total += f; emptyFrames += e; worst = Math.max(worst, e);
    }
    let settle = 0;
    for (; settle < 60; settle++) {
      const [f, e] = await sample();
      if (f && !e) break;
      await page.waitForTimeout(100);
    }
    const cards = await page.evaluate(() => document.querySelectorAll("[data-product-card]").length);
    const longs = await page.evaluate(() => (window as any).__long as number[]);
    console.log(`${net.name}: ${Date.now() - t0} ms; empty card-samples ${emptyFrames}/${total} (${Math.round((100 * emptyFrames) / total)}%), worst ${worst}; settled ${settle * 100} ms after; cards ${cards}; long tasks ${longs.length} (max ${Math.max(0, ...longs)} ms, sum ${longs.reduce((a, b) => a + b, 0)} ms)`);
  });
