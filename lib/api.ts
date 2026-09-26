/**
 * The only door to a backend. The site is a static export with no server,
 * so everything here works in two modes:
 *
 * - NEXT_PUBLIC_API_URL set: requests go to that endpoint (to be provided —
 *   see the approvals list in the README).
 * - Not set (today): nothing leaves the device, and no UI that needs a
 *   backend is shown (no email capture, referrals or social proof).
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export const apiConfigured = API_URL !== "";

export type SignupSource = "saved" | "calibration" | "order" | "drop";

export interface SignupResult {
  ok: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string) => EMAIL.test(s.trim());

/**
 * Email signup (new drops that match your taste) — infrastructure only:
 * without an API nothing is sent or stored, and no UI calls this.
 */
export async function signup(email: string, source: SignupSource, taste?: Record<string, number>): Promise<SignupResult> {
  const clean = email.trim().toLowerCase();
  if (!apiConfigured || !isEmail(clean)) return { ok: false };
  try {
    const r = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: clean, source, taste }),
    });
    return { ok: r.ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Real aggregate data (e.g. "most swiped right this week"). Without an API
 * there is no data, so this resolves to null and callers render nothing —
 * never a made-up number.
 */
export async function fetchTrending(): Promise<{ ids: string[]; label: string } | null> {
  if (!apiConfigured) return null;
  try {
    const r = await fetch(`${API_URL}/trending`);
    if (!r.ok) return null;
    const data = (await r.json()) as { ids?: unknown; label?: unknown };
    return Array.isArray(data.ids) && typeof data.label === "string" ? { ids: data.ids.filter((x): x is string => typeof x === "string"), label: data.label } : null;
  } catch {
    return null;
  }
}

/** Referral code for "Give $10, get $10" — only with an API that issues them. */
export async function fetchReferral(orderNumber: string): Promise<{ code: string; url: string } | null> {
  if (!apiConfigured) return null;
  try {
    const r = await fetch(`${API_URL}/referral`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order: orderNumber }) });
    if (!r.ok) return null;
    const data = (await r.json()) as { code?: unknown; url?: unknown };
    return typeof data.code === "string" && typeof data.url === "string" ? { code: data.code, url: data.url } : null;
  } catch {
    return null;
  }
}
