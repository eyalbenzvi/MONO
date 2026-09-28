/** The Met (collectionapi.metmuseum.org): search, then each object; public domain only (Open Access = CC0). */
import { getJson, pool, type Adapter, type Raw } from "./_pipeline";

const API = "https://collectionapi.metmuseum.org/public/collection/v1";
/** Drawings and Prints, Photographs, Asian Art (woodblock prints; the filter drops the ceramics). */
const DEPARTMENTS = [9, 19, 6];

export const met: Adapter = {
  source: "met",
  async search(world, log) {
    const ids = new Set<number>();
    for (const q of world.queries)
      for (const d of DEPARTMENTS) {
        const r = await getJson<{ objectIDs: number[] | null }>("met", `${API}/search?hasImages=true&departmentId=${d}&q=${encodeURIComponent(q)}`);
        for (const id of r?.objectIDs ?? []) ids.add(id);
      }
    log(`met: ${ids.size} object ids`);
    const out: Raw[] = [];
    await pool([...ids], 8, async (id) => {
      const o = await getJson<any>("met", `${API}/objects/${id}`);
      if (!o) return;
      const cls = [o.classification, o.medium, o.objectName].filter(Boolean).join(", ");
      out.push({
        source: "met",
        key: `met-${id}`,
        record: String(id),
        recordUrl: o.objectURL,
        imageUrl: o.primaryImage,
        title: o.title ?? "",
        maker: o.artistDisplayName || null,
        date: o.objectDate || null,
        credit: [o.artistDisplayName, "The Metropolitan Museum of Art"].filter(Boolean).join(", "),
        classification: cls,
        tags: [...(o.tags ?? []).map((t: { term: string }) => t.term), o.department, o.culture].filter(Boolean),
        description: "",
        width: null,
        height: null,
        mode: /photograph/i.test(o.classification ?? "") ? "photo" : "ink",
        licenseFields: { publicDomain: o.isPublicDomain === true, credit: o.creditLine },
        hasImage: !!o.primaryImage,
      });
    });
    return out.sort((a, b) => a.key.localeCompare(b.key));
  },
};
