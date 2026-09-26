/**
 * Content Security Policy for the static pages (a meta tag: GitHub Pages
 * can't send headers). Written into each page after the build
 * (scripts/tools/postbuild.ts) with the sha256 of that page's own inline
 * scripts — Next's static export inlines its bootstrap data — so there's
 * no 'unsafe-inline' for scripts. Styles keep 'unsafe-inline' (React and
 * the motion library set style attributes). Images: our own files plus
 * data:/blob: (the share image). Requests: our origin, and the API when one
 * is configured. frame-ancestors isn't honoured in a meta tag, so it isn't
 * set.
 */
const API_ORIGIN = (() => {
  try {
    return process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : "";
  } catch {
    return "";
  }
})();

export function contentSecurityPolicy(scriptHashes: string[]) {
  return [
    "default-src 'self'",
    `script-src 'self'${scriptHashes.map((h) => ` 'sha256-${h}'`).join("")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${API_ORIGIN ? ` ${API_ORIGIN}` : ""}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
