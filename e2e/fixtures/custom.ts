import shirts from "../../data/shirts.json";
import { madeAllFor } from "../../lib/custom/products";

type Entry = { id: string; variant: string; title: string };
const ALL = shirts as unknown as Entry[];
/** Catalogue designs a made-for-you tee is drawn like, and designs that have none (picked by variant, never by id). */
export const SKY = ALL.find((s) => s.variant === "sky-night")!;
export const MOON = ALL.find((s) => s.variant === "moon-year")!;
export const PLANETS = ALL.find((s) => s.variant === "planets-date")!;
/** Designs no Make product is drawn like (lib/custom/products madeAllFor). */
export const OTHERS = ALL.filter((s) => madeAllFor(s.variant).length === 0).filter((_, i) => i % 400 === 7).slice(0, 3);
/** Tel Aviv's GeoNames id (data/cities). */
export const TEL_AVIV = 293397;
/** A link's `make` for a spec (lib/custom encodeMake: base64url of the canonical JSON). */
export const make = (spec: object) => Buffer.from(JSON.stringify(spec)).toString("base64url");
export const TLV_1991 = make({ t: "sky", v: 1, p: { c: TEL_AVIV, d: "1991-03-14", w: "The night we met" } });
