/**
 * Smithsonian Open Access (the public bucket, as scripts/photos and scripts/archive read it): CC0
 * images of the units a wave names. A unit's metadata is 256 files (up to ~5 GB for NMNH); they are
 * streamed and only CC0-image records kept. SI_FILES=<n> reads the first n files only (a sample for
 * the counts stop; the counts say so).
 */
import { BUCKET, recordUrl } from "../photos/source";
import type { Adapter, Raw } from "./_pipeline";

export const UNITS: Record<number, string[]> = { 1: ["sil", "nmnhinv", "nmnhfishes"] };
export const sampleFiles = () => Math.min(256, Number(process.env.SI_FILES ?? 256));

async function* lines(url: string): AsyncGenerator<string> {
  const r = await fetch(url);
  if (!r.ok || !r.body) return;
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      yield buf.slice(0, i);
      buf = buf.slice(i + 1);
    }
  }
  if (buf) yield buf;
}

export const smithsonian: Adapter = {
  source: "smithsonian",
  async search(world, log) {
    const out: Raw[] = [];
    const n = sampleFiles();
    const words = new RegExp(`\\b(?:${world.keywords.join("|")})`, "i");
    for (const unit of UNITS[world.wave] ?? []) {
      let seen = 0;
      for (let h = 0; h < n; h++) {
        for await (const line of lines(`${BUCKET}/metadata/edan/${unit}/${h.toString(16).padStart(2, "0")}.txt`)) {
          // Cheap test before parsing: CC0 and a world word somewhere in the line.
          if (!line.includes('"CC0"') || !words.test(line)) continue;
          let r: any;
          try {
            r = JSON.parse(line);
          } catch {
            continue;
          }
          const c = r.content ?? {};
          const d = c.descriptiveNonRepeating ?? {};
          const media = (d.online_media?.media ?? []).find((m: any) => m.type === "Images" && m.usage?.access === "CC0" && m.idsId);
          if (!media) continue;
          seen++;
          const ix = c.indexedStructured ?? {};
          const ft = c.freetext ?? {};
          const text = (k: string) => (ft[k] ?? []).map((x: any) => String(x.content));
          const types: string[] = [...(ix.object_type ?? []), ...text("objectType")];
          const maker = text("name")[0] ?? null;
          out.push({
            source: "smithsonian",
            key: `si-${media.idsId}`,
            record: d.record_ID,
            recordUrl: recordUrl(d.record_ID),
            imageUrl: `https://ids.si.edu/ids/deliveryService?id=${media.idsId}&max=3000`,
            title: String(d.title?.content ?? r.title ?? ""),
            maker,
            date: text("date")[0] ?? null,
            credit: [maker, d.data_source ?? "Smithsonian Institution"].filter(Boolean).join(", "),
            classification: types.join(", "),
            tags: [...(ix.topic ?? []), ...(ix.scientific_name ?? []), unit],
            description: text("notes").slice(0, 2).join(" ").slice(0, 500),
            width: null,
            height: null,
            // Library plates print as ink; a museum's specimen picture is a photograph.
            mode: unit.startsWith("sil") ? "ink" : "photo",
            licenseFields: { license: "CC0" },
            hasImage: true,
          });
        }
      }
      log(`smithsonian ${unit}: ${seen} CC0 records with a world word in ${n}/256 files`);
    }
    return out;
  },
};
