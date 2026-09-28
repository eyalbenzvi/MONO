import shirts from "../../data/shirts.json";

type Entry = { id: string; variant: string; title: string };
const ALL = shirts as unknown as Entry[];
/** Catalogue designs a made-for-you tee is drawn like, and designs that have none (picked by variant, never by id). */
export const SKY = ALL.find((s) => s.variant === "sky-night")!;
export const MOON = ALL.find((s) => s.variant === "moon-year")!;
export const PLANETS = ALL.find((s) => s.variant === "planets-date")!;
const BASES = ["sky-night", "moon-year", "planets-date"];
export const OTHERS = ALL.filter((s) => !BASES.includes(s.variant)).filter((_, i) => i % 400 === 7).slice(0, 3);
/** Tel Aviv's GeoNames id (data/cities). */
export const TEL_AVIV = 293397;
/** A link's `make` for a spec (lib/custom encodeMake: base64url of the canonical JSON). */
export const make = (spec: object) => Buffer.from(JSON.stringify(spec)).toString("base64url");
export const TLV_1991 = make({ t: "sky", v: 1, p: { c: TEL_AVIV, d: "1991-03-14", w: "The night we met" } });
