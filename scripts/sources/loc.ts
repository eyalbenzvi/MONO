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

export const loc: Adapter = {
  source: "loc",
  async search(world, log) {
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
    return out;
  },
};
