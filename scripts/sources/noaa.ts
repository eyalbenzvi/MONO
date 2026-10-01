/**
 * NOAA's Office of Coast Survey historical map and chart collection (historicalcharts.noaa.gov):
 * nautical charts and coast survey sketches, US government works. The site's own search
 * (includes/imageDBDT.php) answers with an HTML table, one row per chart; each chart downloads as
 * a JPG at full size (includes/downloadsingle.php), which the master print scales down. Metadata
 * only here: title, place, type, year, chart number, scale. The search pages are cached like the
 * other adapters' JSON.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { UA, cacheDir, type Adapter, type Raw } from "./_pipeline";

const SITE = "https://historicalcharts.noaa.gov";
/** Engraved and drawn charts: before the photographic reproductions of the 20th century. */
const YEARS = { min: 1800, max: 1920 };

async function getText(url: string): Promise<string | null> {
  const dir = path.join(cacheDir("noaa"), "http");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${createHash("sha1").update(url).digest("hex")}.html`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.ok) {
        const t = await r.text();
        writeFileSync(file, t);
        return t;
      }
      if (r.status < 500 && r.status !== 429) return null;
    } catch {
      /* retried */
    }
    await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
  }
  return null;
}

const SMALL = new Set(["of", "and", "the", "to", "in", "on", "at", "from", "with", "for", "a", "an", "de", "la", "le"]);
/** "PART OF CAPE COD BAY" → "Part of Cape Cod Bay"; initials and state abbreviations stay ("N.Y.", "R.I."). */
export function chartTitle(t: string): string {
  // The office's own name before the chart's ("U.S. Coast Survey Part of James River") is the credit's, not the title's.
  const s = t.replace(/\s+/g, " ").trim().replace(/^u\.?\s?s[.,]?\s*coast (?:and geodetic )?survey\b[\s,:.-]*/i, "");
  if (/[a-z]/.test(s)) return s.charAt(0).toUpperCase() + s.slice(1);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (/^(?:[a-z]\.)+[a-z]?\.?,?$|^us$/.test(w) ? w.toUpperCase() : i > 0 && SMALL.has(w) ? w : w.replace(/(^|[-(/'])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())))
    .join(" ")
    .replace(/\b(Mc|Mac)(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
}

const cell = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** One search page's rows: [file id, file type, title, place, chart type, year, edition, chart number, scale]. */
export function parseRows(html: string) {
  const out: { id: string; ext: string; title: string; place: string; type: string; year: number | null; chart: string; scale: string }[] = [];
  // A row holds a small table of its own (the phone layout), so rows are split at their openings.
  for (const chunk of html.split(/<tr class=(?:even|odd)>/).slice(1)) {
    const row = chunk.replace(/<table class = 'mobonly'>[\s\S]*?<\/table>/g, "");
    const id = /id=d([^\s>]+) name=(\w+)/.exec(chunk);
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => cell(x[1]));
    if (!id || tds.length < 10) continue;
    out.push({ id: id[1], ext: tds[11] || id[2], title: tds[3], place: tds[4], type: tds[5], year: Number(/\d{4}/.exec(tds[6])?.[0]) || null, chart: tds[8], scale: tds[9] });
  }
  return out;
}

export const noaa: Adapter = {
  source: "noaa",
  async search(world, log) {
    const out = new Map<string, Raw>();
    for (const type of world.queries) {
      const q = new URLSearchParams({ title: "", chart: "", yearMin: String(YEARS.min), yearMax: String(YEARS.max), singleYear: "", type, state: "Any", scale: "All Scales", latitude: "", longitude: "", orderby: "", page: "1", cending: "", fresh: "true", resultsPer: "", js: "yes" });
      const html = await getText(`${SITE}/includes/imageDBDT.php?${q}`);
      const rows = html ? parseRows(html) : [];
      log(`noaa: ${type}: ${rows.length} charts`);
      for (const r of rows) {
        if (out.has(r.id) || /^zip$/i.test(r.ext) || !r.title || /^none$/i.test(r.title)) continue;
        out.set(r.id, {
          source: "noaa",
          key: `noaa-${r.id}`,
          record: r.id,
          recordUrl: `${SITE}/image.php?filename=${encodeURIComponent(r.id)}`,
          imageUrl: `${SITE}/includes/downloadsingle.php?filename=${encodeURIComponent(r.id)}&fileExt=.jpg`,
          title: chartTitle(r.title),
          maker: null,
          date: r.year ? String(r.year) : null,
          credit: "Office of Coast Survey, NOAA",
          classification: type.replace(/--/g, ", "),
          tags: [r.place, r.type, r.chart && r.chart !== "none" ? `chart ${r.chart}` : "", r.scale ? `scale 1:${r.scale}` : ""].filter(Boolean),
          description: "",
          width: null,
          height: null,
          mode: "ink",
          licenseFields: { rights: "US government work (NOAA Office of Coast Survey)" },
          hasImage: true,
        });
      }
    }
    log(`noaa: ${out.size} charts`);
    return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
  },
};
