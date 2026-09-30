/**
 * Your Link: a web address, printed as a QR code that scans (encoded by
 * lib/custom/draw/qr), the address set under it. The spec keeps the address
 * without its scheme (the code scans as https://, or http:// with `h: 1`);
 * the host in lower case, the rest exactly as typed. Private: nothing is
 * fetched or checked online; whether the address leads anywhere is the
 * customer's to try (the preview scans).
 */
import { flag, wordsOf, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The address without its scheme: "example.org/for-noa". */
  a: string;
  /** Scans as http:// (https:// otherwise). */
  h?: 1;
  w?: string;
  cap?: Cap;
}

export const NAME = "Your Link";
export const LINK_MAX = 100;
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
/** The host: dot-separated labels, the last with a letter; no port, no user. */
const HOST = new RegExp(`^(?:${LABEL}\\.)+(?=[a-z0-9-]*[a-z])${LABEL}$`);
/** What may follow the host: URL-safe characters, a % only as an escape. */
const REST = /^(?:[/?#](?:[A-Za-z0-9\-._~/?#@!$&'()*+,;=:]|%[0-9A-Fa-f]{2})*)?$/;
const SAFE = /[A-Za-z0-9\-._~/?#@!$&'()*+,;=%:]/;

/** The address split at the end of its host. */
const split = (a: string): [string, string] => {
  const i = a.search(/[/?#]/);
  return i < 0 ? [a, ""] : [a.slice(0, i), a.slice(i)];
};
export const hostOf = (a: string) => split(a)[0];

/** Whether an address (scheme dropped) is one the spec keeps, exactly as spelled. */
export function linkOk(a: string): boolean {
  if (a.length < 4 || a.length > LINK_MAX) return false;
  const [host, rest] = split(a);
  return HOST.test(host) && REST.test(rest) && rest !== "/";
}

/** An address as typed, tidied the way the spec keeps it: trimmed, scheme dropped (http:// remembered), host lower case, a lone trailing slash dropped. */
export function tidyLink(typed: string): { a: string; http: boolean } {
  let t = typed.trim();
  const m = /^(https?):\/\//i.exec(t);
  if (m) t = t.slice(m[0].length);
  let [host, rest] = split(t);
  host = host.toLowerCase().replace(/\.$/, "");
  if (rest === "/") rest = "";
  return { a: host + rest, http: m?.[1].toLowerCase() === "http" };
}

/** What's wrong with a typed address, in one line, or null. */
export function linkProblem(typed: string): string | null {
  const { a } = tidyLink(typed);
  if (!a) return "Add a web address.";
  if (/\s/.test(a)) return "No spaces in a web address.";
  const bad = [...a].find((c) => !SAFE.test(c));
  if (bad) return `A web address can’t hold "${bad}".`;
  if (a.length > LINK_MAX) return `Up to ${LINK_MAX} characters.`;
  const [host, rest] = split(a);
  if (host.includes(":")) return host.split(":")[0].includes(".") ? "No port numbers" : "Only web addresses (https://)";
  if (host.includes("@")) return "No names or passwords in the address.";
  if (!HOST.test(host)) return host.includes(".") ? "That domain doesn’t look right" : "Add the domain, like example.org.";
  if (!REST.test(rest)) return "A % must be followed by two hex digits.";
  return linkOk(a) ? null : "That address doesn’t look right";
}

/** What the code holds. */
export const linkUrl = (p: Pick<Params, "a" | "h">) => `${p.h ? "http" : "https"}://${p.a}`;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };
/** The words (`w`) were the caption's title: the editor now writes cap[0]. */
export const WORDS_TITLE = true;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (typeof p.a !== "string" || !linkOk(p.a)) return null;
  const h = flag(p, "h");
  const w = wordsOf(p);
  if (!h || !w) return null;
  return { a: p.a, ...h, ...w };
}

export const detail = (p: Params) => (p.a.length > 40 ? `${p.a.slice(0, 39)}…` : p.a);

export const PRODUCT: ProductMeta<Params> = {
  line: "Your web address as a QR code that scans.",
  from: "A web address",
  group: "you",
  base: "terminal-data",
  bases: ["terminal-data", "matrix"],
  wordsHint: "Our wedding photos",
  example: { a: "example.org/for-noa" },
  hints: { dense: "Try a shorter address.", faint: "Try a longer address." },
};
