/**
 * The address's query changed in place (replaceState: no new history
 * entry): `mutate` edits the parameters, and the address is rewritten only
 * if they changed. `keepHash` (default) keeps the fragment (#print, #details).
 */
export function updateQuery(mutate: (q: URLSearchParams) => void, { keepHash = true }: { keepHash?: boolean } = {}) {
  const q = new URLSearchParams(window.location.search);
  mutate(q);
  const rest = q.toString();
  const next = `${window.location.pathname}${rest ? `?${rest}` : ""}${keepHash ? window.location.hash : ""}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
}
