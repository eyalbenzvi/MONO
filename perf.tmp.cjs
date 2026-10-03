// Scratch: the video's path on an emulated phone (CPU 4x, 4G), measured. Not committed.
const { chromium, devices } = require("@playwright/test");
const BASE = process.env.BASE || "http://127.0.0.1:4199/";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 120, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (2 * 1024 * 1024) / 8 });
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true });
  });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const sample = () =>
    page.evaluate(() => {
      const vh = innerHeight;
      const frames = [...document.querySelectorAll("main [role=img]")].filter((f) => {
        const r = f.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh && r.width > 0;
      });
      const imgs = frames.map((f) => f.querySelector("img[data-mockup]"));
      return {
        frames: frames.length,
        noSrc: imgs.filter((i) => i && !i.getAttribute("src")).length,
        loading: imgs.filter((i) => i && i.getAttribute("src") && !(i.complete && i.naturalWidth)).length,
        shown: imgs.filter((i) => i && i.complete && i.naturalWidth).length,
      };
    });
  const t0 = Date.now();
  await page.evaluate(() => (window.__long = []));
  await page.locator("a[href$=\"/shop/\"]:visible").first().click();
  const log = [];
  for (let k = 0; k < 40; k++) {
    const s = await sample();
    log.push(`${Date.now() - t0}ms ${JSON.stringify(s)}`);
    if (s.frames && s.shown === s.frames && k > 3) break;
    await page.waitForTimeout(100);
  }
  console.log("SHOP OPEN\n" + log.join("\n"));
  console.log("long tasks", JSON.stringify(await page.evaluate(() => window.__long)));
  // A fast fling: 6 screens down in ~1.2 s, then watch the visible cards fill.
  await page.evaluate(() => (window.__long = []));
  const scroller = await page.evaluateHandle(() => {
    let el = document.querySelector("main [role=img]");
    for (let p = el; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
    return document.scrollingElement;
  });
  const t1 = Date.now();
  const log2 = [];
  for (let k = 0; k < 12; k++) {
    await scroller.evaluate((el) => el.scrollBy(0, 450));
    await page.waitForTimeout(100);
    log2.push(`${Date.now() - t1}ms ${JSON.stringify(await sample())}`);
  }
  for (let k = 0; k < 25; k++) {
    await page.waitForTimeout(100);
    const s = await sample();
    log2.push(`${Date.now() - t1}ms ${JSON.stringify(s)}`);
    if (s.frames && s.shown === s.frames) break;
  }
  console.log("FLING\n" + log2.join("\n"));
  console.log("long tasks", JSON.stringify(await page.evaluate(() => window.__long)));
  await browser.close();
})();
