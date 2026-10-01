/*
 * MONO's service worker: pictures and versioned files kept on the device.
 *
 * GitHub Pages serves every file with max-age=600 and re-stamps all of them on
 * each deploy: after ten minutes, and after every catalogue push, the browser
 * asked again for each picture before showing it, and the shop's cards sat
 * empty meanwhile. Here:
 * - the shop's pictures (img/, prints/) are shown from the device at once and
 *   refreshed behind the scenes (a re-made picture shows from the next view);
 * - files whose name carries their content's hash (_next/static, data/*.<hash>.json)
 *   never change, so they're kept as they are;
 * - pages and everything else go to the network as before (never a stale shop).
 */
const PICTURES = "mono-pictures-v1";
const VERSIONED = "mono-versioned-v1";
/** The most kept of each: the oldest go first (a picture is a few tens of KB; old deploys' scripts age out). */
const MAX_PICTURES = 1500;
const MAX_VERSIONED = 400;
/** A kept picture is checked against the site again after this long (a re-made one shows from the next view after). */
const RECHECK_MS = 24 * 60 * 60 * 1000;

const base = new URL(self.registration.scope).pathname;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mono-") && k !== PICTURES && k !== VERSIONED).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function kind(url) {
  if (url.origin !== self.location.origin || !url.pathname.startsWith(base)) return null;
  const path = url.pathname.slice(base.length);
  if (/^(img|prints)\/[^?]+\.(webp|png|jpg|svg)$/.test(path)) return "picture";
  if (path.startsWith("_next/static/") || /^data\/[\w-]+\.[0-9a-f]{8,}\.json$/.test(path)) return "versioned";
  return null;
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** From the device at once when it's there (refreshed in the background once a day); from the network the first time. */
async function picture(event) {
  const cache = await caches.open(PICTURES);
  const kept = await cache.match(event.request);
  // Kept and checked within the day: nothing to ask (asking for every card would compete with the pictures not yet here).
  if (kept && Date.now() - Date.parse(kept.headers.get("date") || "") < RECHECK_MS) return kept;
  const fresh = fetch(event.request)
    .then(async (res) => {
      if (res.ok && res.status === 200) {
        await cache.put(event.request, res.clone());
        if (!kept) await trim(cache, MAX_PICTURES);
      }
      return res;
    })
    .catch(() => kept ?? Response.error());
  if (kept) {
    event.waitUntil(fresh.then(() => undefined));
    return kept;
  }
  return fresh;
}

/** A file named by its content: once kept, it's the same file for good. */
async function versioned(request) {
  const cache = await caches.open(VERSIONED);
  const kept = await cache.match(request);
  if (kept) return kept;
  const res = await fetch(request);
  if (res.ok && res.status === 200) {
    await cache.put(request, res.clone());
    await trim(cache, MAX_VERSIONED);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const k = kind(new URL(request.url));
  if (k === "picture") event.respondWith(picture(event));
  else if (k === "versioned") event.respondWith(versioned(request));
});
