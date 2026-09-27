/**
 * The last few searches, on this device only (localStorage; never sent).
 * Storage can be missing or refuse (private windows, blocked site data):
 * every access is guarded and search simply works without it.
 */
const KEY = "mono-search-recent";
const MAX = 5;

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable: nothing is remembered */
  }
}

export function pushRecent(query: string): string[] {
  const q = query.trim();
  if (!q) return readRecent();
  const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
  write(next);
  return next;
}

export function removeRecent(query: string): string[] {
  const next = readRecent().filter((x) => x !== query);
  write(next);
  return next;
}
