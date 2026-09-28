/**
 * Internet Archive (the lawful route to BHL scans, biodiversitylibrary.org being blocked here):
 * items of the biodiversity collection under the Public Domain Mark. Single images only
 * (mediatype image); scanned books are counted but not used, a plate inside one having no record.
 */
import { getJson, type Adapter, type Raw } from "./_pipeline";

export const archiveorg: Adapter = {
  source: "archiveorg",
  async search(world, log) {
    const subj = world.queries.map((q) => `"${q}"`).join(" OR ");
    const base = `collection:(biodiversity) AND licenseurl:(*publicdomain*) AND (subject:(${subj}) OR title:(${subj}))`;
    const ask = (q: string, rows: number, page = 1) =>
      getJson<any>("archiveorg", `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=licenseurl&fl[]=subject&fl[]=mediatype&rows=${rows}&page=${page}&output=json`);
    const books = (await ask(`${base} AND mediatype:(texts)`, 0))?.response?.numFound ?? 0;
    const out: Raw[] = [];
    for (let page = 1; page <= 20; page++) {
      const r = await ask(`${base} AND mediatype:(image)`, 100, page);
      const docs = r?.response?.docs ?? [];
      for (const d of docs)
        out.push({
          source: "archiveorg",
          key: `ia-${d.identifier}`,
          record: d.identifier,
          recordUrl: `https://archive.org/details/${d.identifier}`,
          imageUrl: `https://archive.org/download/${d.identifier}/__ia_thumb.jpg`,
          title: String(d.title ?? ""),
          maker: [d.creator].flat()[0] ?? null,
          date: d.date ?? null,
          credit: [[d.creator].flat()[0], "Internet Archive"].filter(Boolean).join(", "),
          classification: "Plate",
          tags: [d.subject].flat().filter(Boolean),
          description: "",
          width: null,
          height: null,
          mode: "ink",
          licenseFields: { license: d.licenseurl },
          hasImage: true,
        });
      if (docs.length < 100) break;
    }
    log(`archiveorg: ${out.length} images; ${books} scanned books (not used: a plate in a book has no record of its own)`);
    return out;
  },
};
