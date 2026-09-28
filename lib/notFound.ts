/**
 * The 404 page's one script. A design without a pre-rendered page
 * (NEXT_PUBLIC_PRERENDER_LIMIT) lands on the 404 at /shop/<id>/: send it on
 * to the client product route (/shop/p/?id=…), keeping its query and hash.
 * Only the designs that have no page are sent (their numbers are listed; ids
 * run to five digits since the content waves); any other path stays on the 404.
 */
export function productRedirectScript(base: string, ids: readonly number[]) {
  const b = base.replace(/\//g, "\\/");
  return `(function(){var s=",${ids.join(",")},",m=location.pathname.match(/^${b}\\/shop\\/(mono-(\\d{4,5}))\\/?$/);if(m&&s.indexOf(","+(+m[2])+",")>=0)location.replace("${base}/shop/p/?id="+m[1]+location.search.replace(/^\\?/,"&")+location.hash)})()`;
}
