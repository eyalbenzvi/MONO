/**
 * The 404 page's one script. A design without a pre-rendered page
 * (NEXT_PUBLIC_PRERENDER_LIMIT) lands on the 404 at /shop/<id>/: send it on
 * to the client product route (/shop/p/?id=…), keeping its query and hash.
 * Runs before the page paints; any other unknown path stays on the 404.
 */
export function productRedirectScript(base: string, total: number) {
  const b = base.replace(/\//g, "\\/");
  return `(function(){var m=location.pathname.match(/^${b}\\/shop\\/(mono-(\\d{4}))\\/?$/);if(m&&+m[2]>=1&&+m[2]<=${total})location.replace("${base}/shop/p/?id="+m[1]+location.search.replace(/^\\?/,"&")+location.hash)})()`;
}
