/**
 * Wikimedia Commons: files in the world's categories (found by a category search, one level of
 * subcategories), with their licence from extmetadata and their sha1 (exact duplicates).
 * Plates, drawings and charts only: a category search drifts into photograph collections (a "Sail
 * plans" search finds "SAIL Amsterdam"), so categories and files that name photographs, objects
 * photographed in a museum, or a single modern ship are left out by their names.
 */
import { getJson, type Adapter, type Raw } from "./_pipeline";

const API = "https://commons.wikimedia.org/w/api.php?format=json&formatversion=2&origin=*";
const strip = (s: unknown) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Category searches per wave (Commons category names vary; the search finds them). */
export const CATEGORY_SEARCHES: Record<number, string[]> = {
  3: [
    "Uranometria", "Atlas coelestis by John Flamsteed", "Atlas Novus Coelestis Doppelmayr", "Selenographia Hevelius", "Maps of the Moon", "Celestial maps", "Star charts", "Celestial planispheres",
    "Architectural elevations", "Les plus beaux édifices de Rome moderne", "Vitruvius Britannicus", "Antiquities of Athens", "Précis des leçons d'architecture",
    "Type specimens", "Specimens of printing types", "Alphabets in art", "Ornamental alphabets", "Knots in art", "Nautical charts 19th century", "Coast Survey charts",
  ],
  2: ["Architectura Navalis Mercatoria", "Ship plans", "Sail plans", "Lines plans of ships", "Nautical charts 18th century", "Lighthouse drawings", "Ship models engravings", "Encyclopédie Marine plates"],
  1: ["Kunstformen der Natur", "Challenger Report plates", "Haeckel Radiolarien", "Haeckel Medusen", "Die Cephalopoden Chun", "Report on the Scientific Results of the Voyage of H.M.S. Challenger", "Fishes illustrations 19th century", "Marine invertebrates illustrations"],
};

/** A category a wave keeps from the search: one that names line work (plans, charts, drawings, plates). */
const LINE_WORK = /\bplans?\b|lines|chart|drawing|architectura navalis|cross sections|chapman|atlas|carta|encyclop|engraving|plates?\b|in art\b|kunstformen|challenger|haeckel|radiolarien|medusen|cephalopoden|illustrations|invertebrates|uranometria|coelest|celestial|planispher|selenograph|maps? of the moon|elevations?\b|édifices|vitruvius|antiquities of athens|leçons d'architecture|type specimens|printing types|alphabets?\b|knots\b/i;
/** …and not a photograph collection, a museum's object photographs, one ship's or class's page, or a HABS/HAER set (copies of the LoC's own sheets, which the LoC adapter reads at the source). */
const NOT_LINE_WORK = /photograph|\bHABS\b|\bHAER\b|sail amsterdam|rijksmuseum|full sail|proposed or planned|^Category:PLANS |\(ship, \d{4}\)|\bIMO \d|trawler|type \d+ frigate|svg\b/i;
/** A file that is a photograph by its own categories (press photos, a photographer's own upload). */
const PHOTO_FILE = /photographs? taken on|\bphotographs? (?:of|by|from)\b|self-published work|images from anefo|images from nationaal archief|\bphotos? (?:of|by)\b/i;

export const wikimedia: Adapter = {
  source: "wikimedia",
  async search(world, log) {
    const cats = new Set<string>();
    for (const q of CATEGORY_SEARCHES[world.wave] ?? []) {
      const r = await getJson<any>("wikimedia", `${API}&action=query&list=search&srnamespace=14&srlimit=5&srsearch=${encodeURIComponent(q)}`);
      for (const h of r?.query?.search ?? []) cats.add(h.title);
    }
    // One level of subcategories.
    for (const c of [...cats]) {
      const r = await getJson<any>("wikimedia", `${API}&action=query&list=categorymembers&cmtype=subcat&cmlimit=100&cmtitle=${encodeURIComponent(c)}`);
      for (const m of r?.query?.categorymembers ?? []) cats.add(m.title);
    }
    // From the second wave on (the first's searches named plate series only): line work only.
    if (world.wave >= 2) for (const c of [...cats]) if (!LINE_WORK.test(c) || NOT_LINE_WORK.test(c)) cats.delete(c);
    log(`wikimedia: ${cats.size} categories: ${[...cats].join(" | ")}`);
    const out = new Map<number, Raw>();
    for (const c of cats) {
      let cont = "";
      for (let page = 0; page < 40; page++) {
        const url = `${API}&action=query&generator=categorymembers&gcmtype=file&gcmlimit=50&gcmtitle=${encodeURIComponent(c)}${cont}&prop=imageinfo&iiprop=url|size|sha1|mime|extmetadata&iiurlwidth=2400&iiextmetadatafilter=LicenseShortName|UsageTerms|License|Artist|DateTimeOriginal|ImageDescription|ObjectName|Credit|Categories|Copyrighted`;
        const r = await getJson<any>("wikimedia", url);
        for (const p of r?.query?.pages ?? []) {
          const ii = p.imageinfo?.[0];
          if (!ii || out.has(p.pageid)) continue;
          const m = ii.extmetadata ?? {};
          const v = (k: string) => strip(m[k]?.value);
          if (world.wave >= 2 && PHOTO_FILE.test(v("Categories"))) continue;
          const title = v("ObjectName") || String(p.title).replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "");
          out.set(p.pageid, {
            source: "wikimedia",
            key: `wikimedia-${p.pageid}`,
            record: String(p.pageid),
            recordUrl: ii.descriptionurl,
            imageUrl: ii.thumburl ?? ii.url,
            title,
            maker: v("Artist") || null,
            date: v("DateTimeOriginal") || null,
            credit: [v("Artist"), "Wikimedia Commons"].filter(Boolean).join(", "),
            classification: /^image\/(jpeg|png|tiff)$/.test(ii.mime) ? "Plate" : ii.mime,
            tags: [c.replace(/^Category:/, ""), ...v("Categories").split("|")].filter(Boolean),
            description: v("ImageDescription").slice(0, 500),
            width: ii.width ?? null,
            height: ii.height ?? null,
            mode: "ink",
            licenseFields: { license: v("LicenseShortName") || v("License"), rights: [v("UsageTerms"), v("Copyrighted") === "False" ? "public domain" : ""].filter(Boolean).join(" | "), credit: v("Credit") },
            hasImage: /^image\//.test(ii.mime ?? ""),
            sha: ii.sha1,
          } as Raw);
        }
        if (!r?.continue?.gcmcontinue) break;
        cont = `&gcmcontinue=${encodeURIComponent(r.continue.gcmcontinue)}`;
      }
    }
    log(`wikimedia: ${out.size} files`);
    return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
  },
};
