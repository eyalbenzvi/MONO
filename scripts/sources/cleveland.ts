/** Cleveland Museum of Art Open Access (openaccess-api.clevelandart.org): CC0 works with images. */
import { getJson, type Adapter, type Raw } from "./_pipeline";

const TYPES = ["Print", "Drawing", "Photograph"];

export const cleveland: Adapter = {
  source: "cleveland",
  async search(world, log) {
    const seen = new Map<number, Raw>();
    for (const q of world.queries)
      for (const type of TYPES)
        for (let skip = 0; skip < 1000; skip += 100) {
          const r = await getJson<{ data: any[]; info: { total: number } }>("cleveland", `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&cc0=1&has_image=1&type=${type}&limit=100&skip=${skip}`);
          for (const a of r?.data ?? []) {
            if (seen.has(a.id)) continue;
            const img = a.images?.print ?? a.images?.web ?? {};
            const maker = a.creators?.[0]?.description?.replace(/\s*\(.*$/, "") || null;
            seen.set(a.id, {
              source: "cleveland",
              key: `cleveland-${a.id}`,
              record: String(a.id),
              recordUrl: a.url,
              imageUrl: img.url ?? "",
              title: a.title ?? "",
              maker,
              date: a.creation_date || null,
              credit: [maker, "The Cleveland Museum of Art"].filter(Boolean).join(", "),
              classification: [a.type, a.technique].filter(Boolean).join(", "),
              tags: [a.department, a.culture?.[0], ...(a.support_materials ?? [])].filter(Boolean),
              description: a.description ?? "",
              width: Number(img.width) || null,
              height: Number(img.height) || null,
              mode: /photograph/i.test(a.type ?? "") ? "photo" : "ink",
              licenseFields: { license: a.share_license_status, credit: a.credit_line },
              hasImage: !!img.url,
            });
          }
          if (!r || skip + 100 >= r.info.total) break;
        }
    log(`cleveland: ${seen.size} records`);
    return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
  },
};
