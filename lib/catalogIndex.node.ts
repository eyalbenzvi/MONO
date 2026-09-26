import data from "@/data/shirts.index.json";
import manifest from "@/data/shirts.index.manifest.json";
import type { CatalogIndex } from "./catalogIndex";

/** Node (scripts, tests): the index read straight from data/, synchronously. */
export const INDEX_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/${manifest.file}`;
export const loadIndex = (): CatalogIndex => data;
