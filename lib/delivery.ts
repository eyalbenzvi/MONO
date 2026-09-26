import { STORE_POLICY } from "@/lib/store-policy";

const DAY = 86_400_000;

/** `date` moved forward by `n` business days (Mon–Fri), at the start of that day. */
export function addBusinessDays(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let left = n;
  while (left > 0) {
    d.setTime(d.getTime() + DAY);
    // Stay on calendar days across DST changes.
    d.setHours(0, 0, 0, 0);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/**
 * Estimated arrival window for an order placed at `now`, from the store's
 * delivery policy (print + ship, then transit; business days).
 */
export function arrivalRange(now: Date = new Date()): { from: Date; to: Date } {
  const { shipDays, transitDays } = STORE_POLICY.delivery;
  return { from: addBusinessDays(now, shipDays[0] + transitDays[0]), to: addBusinessDays(now, shipDays[1] + transitDays[1]) };
}

/** "Arrives Tue 6 – Fri 9 Oct" (month once when both ends share it). */
export function formatArrival({ from, to }: { from: Date; to: Date }): string {
  const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });
  return from.getMonth() === to.getMonth()
    ? `${day(from)} – ${day(to)} ${month(to)}`
    : `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`;
}
