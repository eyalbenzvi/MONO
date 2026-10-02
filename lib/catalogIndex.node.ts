import bases from "@/data/make/bases.json";
import data from "@/data/shirts.index.json";
import manifest from "@/data/shirts.index.manifest.json";
import type { ShirtProduct } from "@/types/shirt";
import type { CatalogIndex } from "./catalogIndex";

export type { CatalogIndex };

/** Node (scripts, tests): the index read straight from data/, synchronously (with the Make bases, as published). */
export const indexUrl = () => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/${manifest.file}`;
export const loadIndex = (): CatalogIndex => ({ ...data, makeBases: bases as unknown as ShirtProduct[] });
