/** Art Institute of Chicago (api.artic.edu): public-domain works (released CC0), image by IIIF. */
import { getJson, type Adapter, type Raw } from "./_pipeline";

const FIELDS = "id,title,artist_title,date_display,classification_titles,medium_display,artwork_type_title,subject_titles,term_titles,department_title,image_id,thumbnail,is_public_domain,credit_line,copyright_notice";

export const artic: Adapter = {
  source: "artic",
  async search(world, log) {
    const seen = new Map<number, Raw>();
    for (const q of world.queries)
      for (let page = 1; page <= 10; page++) {
        const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&query[term][is_public_domain]=true&fields=${FIELDS}&limit=100&page=${page}`;
        const r = await getJson<{ data: any[]; pagination: { total_pages: number } }>("artic", url);
        for (const a of r?.data ?? []) {
          if (seen.has(a.id)) continue;
          const t = a.thumbnail ?? {};
          seen.set(a.id, {
            source: "artic",
            key: `artic-${a.id}`,
            record: String(a.id),
            recordUrl: `https://www.artic.edu/artworks/${a.id}`,
            imageUrl: a.image_id ? `https://www.artic.edu/iiif/2/${a.image_id}/full/1686,/0/default.jpg` : "",
            title: a.title ?? "",
            maker: a.artist_title || null,
            date: a.date_display || null,
            credit: [a.artist_title, "Art Institute of Chicago"].filter(Boolean).join(", "),
            classification: [a.artwork_type_title, ...(a.classification_titles ?? []), a.medium_display].filter(Boolean).join(", "),
            tags: [...(a.subject_titles ?? []), ...(a.term_titles ?? []), a.department_title].filter(Boolean),
            description: "",
            width: t.width ?? null,
            height: t.height ?? null,
            mode: /photograph/i.test(a.artwork_type_title ?? "") ? "photo" : "ink",
            licenseFields: { publicDomain: a.is_public_domain === true, rights: a.copyright_notice ?? null, credit: a.credit_line },
            hasImage: !!a.image_id,
          });
        }
        if (!r || page >= r.pagination.total_pages) break;
      }
    log(`artic: ${seen.size} records`);
    return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
  },
};
