/**
 * Library of Congress, HABS/HAER/HALS: measured drawings (the survey's sheets, line work made for
 * the government) of the world's structures and vessels. Rights: the survey's own statement, "No
 * known restrictions on images made by the U.S. Government" — only its drawings are used (photos
 * may copy other sources; data pages are text). Image by the LoC's IIIF service on the sheet's TIFF.
 */
import { getJson, type Adapter, type Raw } from "./_pipeline";

const COLLECTION = "https://www.loc.gov/collections/historic-american-buildings-landscapes-and-engineering-records/";
/** At most this many sheets per survey (a lighthouse's elevation and section, not its every detail). */
const SHEETS_PER_ITEM = 2;

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
      let k = 0;
      for (const variants of drawings.files ?? []) {
        if (k >= SHEETS_PER_ITEM) break;
        const tif = (variants as any[]).find((f) => f.mimetype === "image/tiff");
        if (!tif?.url) continue;
        // .../service/pnp/habshaer/pa/pa0400/pa0452/sheet/00002a.tif → the IIIF id service:pnp:habshaer:…:00002a
        const m = /storage-services\/service\/(.+)\.tif$/.exec(tif.url);
        if (!m) continue;
        const iiif = `https://tile.loc.gov/image-services/iiif/service:${m[1].replace(/\//g, ":")}/full/pct:25/0/default.jpg`;
        const sheet = m[1].split("/").pop()!;
        k++;
        out.push({
          source: "loc",
          key: `loc-${slug}-${sheet}`,
          record: `${slug}/${sheet}`,
          recordUrl: `https://www.loc.gov/item/${slug}/`,
          imageUrl: iiif,
          title: String(it.title ?? d.item?.title ?? ""),
          maker: "Historic American Buildings Survey",
          date: d.item?.date ?? null,
          credit: "Historic American Buildings Survey, Library of Congress",
          classification: "Measured drawing",
          tags: [...(it.subject ?? []), ...(d.item?.subjects ?? [])].map(String),
          description: "",
          width: tif.width ? Math.round(tif.width / 4) : null,
          height: tif.height ? Math.round(tif.height / 4) : null,
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
