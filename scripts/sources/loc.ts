/**
 * Library of Congress, HABS/HAER/HALS: measured drawings (the survey's sheets, line work made for
 * the government) of the world's structures and vessels. Rights: the survey's own statement, "No
 * known restrictions on images made by the U.S. Government" — only its drawings are used (photos
 * may copy other sources; data pages are text). Image by the LoC's IIIF service on the sheet's master
 * (the "master:" id; it serves only full size, so the full sheet is downloaded and the master print
 * scales it). The record's title is cut to the structure's name (the address, town and county out).
 */
import { getJson, type Adapter, type Raw } from "./_pipeline";

const COLLECTION = "https://www.loc.gov/collections/historic-american-buildings-landscapes-and-engineering-records/";
/** The Geography and Map Division's digitized maps (from wave 3: World.sources.loc.maps). */
const MAPS = "https://www.loc.gov/maps/";
/** A master print is made at 2,400 px: the IIIF service scales the sheet to that (its "service:" ids allow it). */
const MAP_SIZE = "!2400,2400";
/** At most this many sheets per survey (a lighthouse's elevation and section, not its every detail). */
const SHEETS_PER_ITEM = 2;

/** Where a HABS/HAER title's name ends and its address begins ("…, 2788 Harborview Drive, Gig Harbor, Pierce County, WA"). */
const PLACE = /^(?:\d|foot of\b|near\b|vicinity\b|off\b)|\b(?:highway|route|road|street|avenue|drive)\b|\b(?:county|parish|borough|township|vicinity|\(subdivision\))\b|^[A-Z]{2}$/i;
export function surveyName(title: string): string {
  const parts = title.split(/,\s+/);
  const name: string[] = [];
  for (const p of parts) {
    if (name.length && PLACE.test(p.trim())) break;
    // A part the name already says ("Hunting Island Lighthouse, Lighthouse").
    if (name.length && name[0].toLowerCase().includes(p.trim().toLowerCase())) continue;
    name.push(p.trim());
    if (name.length === 2) break;
  }
  return name.join(", ");
}
/** A subject as the API writes it: a string, or {name: url}. */
const subjectNames = (list: unknown[]) => list.flatMap((x) => (typeof x === "string" ? [x] : x && typeof x === "object" ? Object.keys(x) : []));

/** A catalogue name as a credit: "Des Barres, Joseph F. W. (Joseph Frederick Wallet), 1729-1824" → "Joseph F. W. Des Barres"; a body stays ("United States. Coast Survey"). */
export function makerName(name: string): string {
  const s = name.replace(/\s*\([^)]*\)/g, "").replace(/,?\s*(?:active |approximately |ca\. )?\d{3,4}\??-(?:\d{3,4})?\??\.?$/, "").replace(/,\s*$/, "").trim();
  const m = /^([^,.]+),\s*([^,]+?)(?:,\s*(?:Sir|Baron|Freiherr|comte|marquis)\b.*)?$/.exec(s);
  return m ? `${m[2].trim()} ${m[1].trim()}` : s.replace(/\.$/, "");
}
const yearOf = (d: unknown) => Number(/\b(1[5-9]\d\d)\b/.exec(String(d ?? ""))?.[1]) || null;
const stripHtml = (s: unknown) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** The map division's records for the world's map searches: the first sheet of each, scaled by IIIF. */
async function mapSheets(queries: string[], log: (msg: string) => void): Promise<Raw[]> {
  const items = new Map<string, any>();
  for (const q of queries)
    for (let sp = 1; sp <= 4; sp++) {
      const r = await getJson<any>("loc", `${MAPS}?q=${encodeURIComponent(q)}&fa=online-format:image&fo=json&c=100&sp=${sp}`);
      for (const it of r?.results ?? []) if (it.id && !items.has(it.id)) items.set(it.id, it);
      if (!r?.pagination?.next) break;
    }
  log(`loc maps: ${items.size} records`);
  const out: Raw[] = [];
  for (const [id, it] of items) {
    const slug = /\/item\/([^/]+)\/?$/.exec(id)?.[1];
    if (!slug) continue;
    const d = await getJson<any>("loc", `https://www.loc.gov/item/${slug}/?fo=json`);
    if (!d?.item) continue;
    const files: any[] = d.resources?.[0]?.files?.[0] ?? [];
    const jpg = files.find((f) => f.mimetype === "image/jpeg" && /image-services\/iiif\/service:/.test(String(f.url)));
    const big = files.find((f) => f.mimetype === "image/jp2") ?? files.reduce((a, f) => ((f.width ?? 0) > (a?.width ?? 0) ? f : a), null);
    const base = /^(https:\/\/tile\.loc\.gov\/image-services\/iiif\/service:[^/]+)\//.exec(String(jpg?.url ?? ""))?.[1];
    if (!base) continue;
    const advisory = stripHtml(d.item.rights_advisory);
    const year = yearOf(d.item.date ?? it.date);
    const maker = (d.item.contributor_names ?? it.contributor ?? [])[0];
    out.push({
      source: "loc",
      key: `loc-map-${slug}`,
      record: `map/${slug}`,
      recordUrl: `https://www.loc.gov/item/${slug}/`,
      imageUrl: `${base}/full/${MAP_SIZE}/0/default.jpg`,
      title: String(d.item.title ?? it.title ?? "").replace(/^\[|\]$/g, "").replace(/\s*\/\s*$/, "").trim(),
      maker: maker ? makerName(String(maker)) : null,
      date: year ? String(year) : d.item.date ?? null,
      credit: "Geography and Map Division, Library of Congress",
      classification: "Map",
      tags: [...new Set([...subjectNames([...(it.subject ?? []), ...(d.item.subjects ?? [])]), ...(d.item.genre ?? [])].map(String))],
      description: stripHtml(d.item.summary ?? "").slice(0, 300),
      width: big?.width || null,
      height: big?.height || null,
      mode: "ink",
      // A Rights Advisory on the record is judged alone; without one, the division's statement and the year.
      licenseFields: advisory ? { rights: advisory } : { rights: stripHtml((d.item.rights ?? []).join(" ")), published: year },
      hasImage: true,
    });
  }
  log(`loc maps: ${out.length} sheets`);
  return out;
}

export const loc: Adapter = {
  source: "loc",
  async search(world, log) {
    const maps = world.sources?.loc?.maps?.length ? await mapSheets(world.sources.loc.maps, log) : [];
    const items = new Map<string, any>();
    for (const q of world.queries)
      for (let sp = 1; sp <= 5; sp++) {
        const r = await getJson<any>("loc", `${COLLECTION}?q=${encodeURIComponent(q)}&fo=json&c=100&sp=${sp}`);
        for (const it of r?.results ?? []) if (it.id && !items.has(it.id)) items.set(it.id, it);
        if (!r?.pagination?.next) break;
      }
    log(`loc: ${items.size} surveys`);
    const out: Raw[] = [];
    for (const [id, it] of items) {
      const slug = /\/item\/([^/]+)\/?$/.exec(id)?.[1];
      if (!slug) continue;
      const d = await getJson<any>("loc", `https://www.loc.gov/item/${slug}/?fo=json`);
      if (!d) continue;
      const rights = String(d.item?.rights_advisory ?? "");
      const drawings = (d.resources ?? []).find((r: any) => /^drawings/i.test(String(r.caption ?? "").trim()));
      if (!drawings) continue;
      const survey = /\b(HABS|HAER|HALS)\b/.exec(String(drawings.caption))?.[1] ?? "HABS";
      const maker = { HABS: "Historic American Buildings Survey", HAER: "Historic American Engineering Record", HALS: "Historic American Landscapes Survey" }[survey]!;
      let k = 0;
      for (const variants of drawings.files ?? []) {
        if (k >= SHEETS_PER_ITEM) break;
        const tif = (variants as any[]).find((f) => f.mimetype === "image/tiff");
        if (!tif?.url) continue;
        // .../storage-services/master/pnp/habshaer/wa/wa0800/wa0863/sheet/00001a.tif → the IIIF id master:pnp:habshaer:…:00001a
        // (full size only: the service refuses a scaled request on these ids).
        const m = /storage-services\/(master|service)\/(.+)\.tif$/.exec(tif.url);
        if (!m) continue;
        const iiif = `https://tile.loc.gov/image-services/iiif/${m[1]}:${m[2].replace(/\//g, ":")}/full/full/0/default.jpg`;
        const sheet = m[2].split("/").pop()!;
        k++;
        out.push({
          source: "loc",
          key: `loc-${slug}-${sheet}`,
          record: `${slug}/${sheet}`,
          recordUrl: `https://www.loc.gov/item/${slug}/`,
          imageUrl: iiif,
          title: surveyName(String(it.title ?? d.item?.title ?? "")),
          maker,
          date: d.item?.date ?? null,
          credit: `${maker}, Library of Congress`,
          classification: "Measured drawing",
          tags: [...new Set(subjectNames([...(it.subject ?? []), ...(d.item?.subjects ?? [])]))],
          description: "",
          width: tif.width || null,
          height: tif.height || null,
          mode: "ink",
          licenseFields: { rights },
          hasImage: true,
        });
      }
    }
    log(`loc: ${out.length} sheets`);
    return [...maps, ...out];
  },
};
