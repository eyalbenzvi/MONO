"use client";

import { useEffect, useState } from "react";
import { assetUrl, getShirtById, shardFile, shardOf } from "@/lib/catalog";
import type { ShirtDetails } from "@/types/shirt";

/**
 * Descriptions, subjects, print sizes and precomputed "similar" lists,
 * fetched on demand from the generator's shards (public/data/details-<k>.<hash>.json;
 * size and hashes come from the index head) so they stay out of the JS
 * bundle. One request per shard, cached (the hash makes the file immutable).
 */
type Shard = Record<string, { d: string; s: string[]; t?: string; p?: [number, number] }>;
const shards = new Map<number, Promise<Shard>>();

function loadShard(k: number): Promise<Shard> {
  let p = shards.get(k);
  if (!p) {
    p = fetch(assetUrl(shardFile(k))).then((r) => {
      if (!r.ok) throw new Error(`details-${k}: ${r.status}`);
      return r.json() as Promise<Shard>;
    });
    // A failed request can be retried later (e.g. back online).
    p.catch(() => shards.delete(k));
    shards.set(k, p);
  }
  return p;
}

export async function fetchDetails(id: string): Promise<ShirtDetails | null> {
  const shirt = getShirtById(id);
  if (!shirt) return null;
  const entry = (await loadShard(shardOf(shirt)))[id];
  return entry ? { description: entry.d, similar: entry.s, subject: entry.t, printCm: entry.p ? { width: entry.p[0], height: entry.p[1] } : undefined } : null;
}

/**
 * Details for one design: `initial` when the page already has them (the
 * pre-rendered product page passes them as props), otherwise fetched. Null
 * while loading or when offline — callers render without them.
 */
export function useShirtDetails(id: string | null, initial?: ShirtDetails | null): ShirtDetails | null {
  const [state, setState] = useState<{ id: string | null; details: ShirtDetails | null }>({ id, details: initial ?? null });
  const current = state.id === id ? state.details : (initial ?? null);
  useEffect(() => {
    if (!id || initial) return;
    let live = true;
    fetchDetails(id)
      .then((details) => live && setState({ id, details }))
      .catch(() => live && setState({ id, details: null }));
    return () => {
      live = false;
    };
  }, [id, initial]);
  return current;
}
