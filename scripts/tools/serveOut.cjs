// Static server for the export (out/), honouring NEXT_PUBLIC_BASE_PATH and
// answering unknown paths with 404.html like GitHub Pages does.
//   node scripts/tools/serveOut.cjs [port]      (used by Playwright)
//   const { serve } = require("./serveOut.cjs") (used by smoke.cjs)
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../../out");
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".txt": "text/plain", ".xml": "application/xml", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };

function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (BASE_PATH && url.startsWith(BASE_PATH)) url = url.slice(BASE_PATH.length) || "/";
    let file = path.join(OUT, url);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
    let status = 200;
    if (!file.startsWith(OUT) || !fs.existsSync(file)) {
      file = path.join(OUT, "404.html");
      status = 404;
    }
    res.writeHead(status, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

module.exports = { serve, OUT, BASE_PATH };

if (require.main === module) {
  if (!fs.existsSync(path.join(OUT, "index.html"))) {
    console.error("out/ not found — run `npm run build` first");
    process.exit(1);
  }
  serve(Number(process.argv[2]) || 4173).then((s) => console.log(`serving out/ on http://127.0.0.1:${s.address().port}${BASE_PATH}/`));
}
