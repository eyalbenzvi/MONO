// Scratch, not committed: the video's path on a throttled phone, measured.
import { test } from "@playwright/test";
import { seed, hydrated } from "./helpers";

test("perf: open Shop from Discover, then fling", async ({ page, context }) => {
  test.setTimeout(240_000);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 120, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (2 * 1024 * 1024) / 8 });
  await page.addInitScript(() => {
    (window as any).__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as any).__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true });
  });
  await seed(page);
  await page.goto("./");
  await hydrated(page);
  await page.waitForTimeout(3000);
  const sample = () =>
    page.evaluate(() => {
      const vh = innerHeight;
      const frames = [...document.querySelectorAll("main [role=img]")].filter((f) => {
        const r = f.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh && r.width > 0;
      });
      const imgs = frames.map((f) => f.querySelector("img[data-mockup]") as HTMLImageElement | null);
      return [frames.length, imgs.filter((i) => i && !i.getAttribute("src")).length, imgs.filter((i) => i && i.getAttribute("src") && !(i.complete && i.naturalWidth)).length, imgs.filter((i) => i && i.complete && i.naturalWidth).length].join("/");
    });
  await page.evaluate(() => ((window as any).__long = []));
  const t0 = Date.now();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop" }).click();
  const log: string[] = [];
  for (let k = 0; k < 50; k++) {
    const s = await sample();
    log.push(`${Date.now() - t0}:${s}`);
    const [f, , , shown] = s.split("/").map(Number);
    if (f && shown === f && k > 2) break;
    await page.waitForTimeout(100);
  }
  console.log("SHOP OPEN (frames/noSrc/loading/shown)\n" + log.join("  "));
  console.log("long tasks", JSON.stringify(await page.evaluate(() => (window as any).__long)));
  await page.evaluate(() => ((window as any).__long = []));
  const t1 = Date.now();
  const log2: string[] = [];
  for (let k = 0; k < 12; k++) {
    await page.evaluate(() => {
      let el: Element | null = document.querySelector("main [role=img]");
      for (; el; el = el.parentElement) if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) break;
      (el ?? document.scrollingElement)!.scrollBy(0, 450);
    });
    await page.waitForTimeout(100);
    log2.push(`${Date.now() - t1}:${await sample()}`);
  }
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(100);
    const s = await sample();
    log2.push(`${Date.now() - t1}:${s}`);
    const [f, , , shown] = s.split("/").map(Number);
    if (f && shown === f) break;
  }
  console.log("FLING\n" + log2.join("  "));
  console.log("long tasks", JSON.stringify(await page.evaluate(() => (window as any).__long)));
  // Search: open it, type, time to results.
  await page.evaluate(() => ((window as any).__long = []));
  const t2 = Date.now();
  const pClick = await page.evaluate(() => Math.round(performance.now()));
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
  await page.getByRole("button", { name: /^Search/ }).first().click();
  const box = page.getByRole("searchbox").or(page.getByRole("combobox")).first();
  await box.waitFor();
  const t3 = Date.now();
  const pOpen = await page.evaluate(() => Math.round(performance.now()));
  console.log("marks click", pClick, "open", pOpen);
  const counts = await page.evaluate(() => ({ dom: document.getElementsByTagName("*").length, cards: document.querySelectorAll("[data-product-card]").length }));
  console.log("DOM before search", JSON.stringify(counts));
  await box.pressSequentially("owl", { delay: 120 });
  console.log("typed at", await page.evaluate(() => Math.round(performance.now())));
  await page.waitForTimeout(1500);
  const { profile } = await cdp.send("Profiler.stop");
  console.log("DOM after search", JSON.stringify(await page.evaluate(() => ({ dom: document.getElementsByTagName("*").length, cards: document.querySelectorAll("[data-product-card]").length }))));
  require("fs").writeFileSync("/tmp/claude-0/-home-user-MONO/3561ca6a-59c4-5b35-8aa4-72da3099c867/scratchpad/search.cpuprofile", JSON.stringify(profile));
  console.log(`SEARCH open ${t3 - t2}ms; long tasks`, JSON.stringify(await page.evaluate(() => (window as any).__long)));
});
