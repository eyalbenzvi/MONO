/**
 * When an upload's raster is deleted from the device (brief 6.8):
 * 30 days after its review cleared (unless the Open Call accepted it),
 * 7 days after it was made if it never reached an order (abandoned).
 * "Clear all" in /me clears everything at once.
 */
export const DAY = 86_400_000;
export const KEEP_CLEARED = 30 * DAY;
export const KEEP_ABANDONED = 7 * DAY;

export interface UploadLife {
  id: string;
  createdAt: number;
  /** In the bag now. */
  inBag: boolean;
  /** Ordered: when its review cleared, if it has. */
  clearedAt?: number;
  ordered: boolean;
  accepted: boolean;
}

/** The uploads whose raster should go now. */
export function expired(list: UploadLife[], now: number): string[] {
  return list
    .filter((u) => {
      if (u.accepted || u.inBag) return false;
      if (u.clearedAt !== undefined) return now - u.clearedAt >= KEEP_CLEARED;
      if (u.ordered) return false;
      return now - u.createdAt >= KEEP_ABANDONED;
    })
    .map((u) => u.id);
}
