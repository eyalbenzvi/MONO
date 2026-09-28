"use client";

import { useCartStore } from "@/store/cartStore";
import { useMakeStore } from "@/store/makeStore";
import { useUiStore } from "@/store/useUiStore";
import { available, deleteUpload, uploadIds } from "./store";
import { expired } from "./retention";
import { stateAt, REVIEW_MS } from "./review";
import { acceptedDesigns } from "./designs";

export const CLEARED_LINE = "A file was cleared from this device, so it left the bag.";

/**
 * After the stores load: bag lines whose raster is no longer on the device
 * leave the bag (said once), and rasters past their keeping time go
 * (lib/upload/retention). IndexedDB is asynchronous, so this runs apart from
 * the cart's own (synchronous) sanitising.
 */
export async function pruneUploads(now = Date.now()) {
  if (!available()) return;
  let ids: Set<string>;
  try {
    ids = new Set(await uploadIds());
  } catch {
    return;
  }
  const cart = useCartStore.getState().cart;
  const gone = cart.filter((l) => l.upload && !ids.has(l.upload.id));
  if (gone.length) {
    useCartStore.setState({ cart: cart.filter((l) => !gone.includes(l)) });
    useUiStore.getState().showToast(CLEARED_LINE);
  }

  const make = useMakeStore.getState();
  const inBag = new Set(useCartStore.getState().cart.flatMap((l) => (l.upload ? [l.upload.id] : [])));
  const accepted = new Set(acceptedDesigns(make.offers, now).map((d) => d.uploadId));
  const tickets = Object.values(make.reviews);
  const lives = [...ids].map((id) => {
    const t = tickets.filter((x) => x.uploadId === id).sort((a, b) => b.submittedAt - a.submittedAt)[0];
    const cleared = t && stateAt(t, now) === "cleared" ? t.submittedAt + (t.near || t.force?.state === "person" ? 2 : 1) * REVIEW_MS : undefined;
    return { id, createdAt: make.uploads[id]?.createdAt ?? 0, inBag: inBag.has(id), ordered: !!t || !!make.uploads[id]?.ordered, clearedAt: cleared, accepted: accepted.has(id) };
  });
  const old = expired(lives, now);
  for (const id of old) await deleteUpload(id).catch(() => {});
  // An ordered upload keeps its metadata (the last order shows its title); the rest is forgotten with its raster.
  if (old.length) make.forgetUploads(old.filter((id) => !tickets.some((t) => t.uploadId === id)));
}
