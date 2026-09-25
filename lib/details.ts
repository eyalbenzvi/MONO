"use client";

import { useEffect, useState } from "react";
import { assetUrl, getShirtById } from "@/lib/catalog";
import type { ShirtDetails } from "@/types/shirt";

/**
 * Descriptions and precomputed "similar" lists, fetched on demand from the
 * generator's shards (public/data/details-<k>.json, SHARD_SIZE designs each)
 * so they stay out of the JS bundle. One request per shard, cached.
 */
const SHARD_SIZE = 100;

type Shard = Record<string, { d: string; s: string[] }>;
const shards = new Map<number, Promise<Shard>>();

function loadShard(k: number): Promise<Shard> {
  let p = shards.get(k);
  if (!p) {
    p = fetch(assetUrl(`/data/details-${k}.json`)).then((r) => {
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
  const entry = (await loadShard(Math.floor((shirt.n - 1) / SHARD_SIZE)))[id];
  return entry ? { description: entry.d, similar: entry.s } : null;
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
