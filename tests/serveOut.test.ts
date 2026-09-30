// @vitest-environment node
import { createRequire } from "module";
import http from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { serve } = require("../scripts/tools/serveOut.cjs") as { serve: (port?: number) => Promise<http.Server> };

let server: http.Server;
let port = 0;
beforeAll(async () => {
  server = await serve(0);
  port = (server.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

/** The status for a raw request path (sent as is, no client-side normalising). */
const statusOf = (p: string) =>
  new Promise<number>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: p, method: "GET" }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });

describe("the static test server (SEC-16)", () => {
  it("answers a malformed escape with 400 and keeps serving", async () => {
    expect(await statusOf("/%E0%A4%A")).toBe(400);
    expect(await statusOf("/definitely-not-a-page")).toBe(404);
  });
  it("never serves outside out/, even a sibling folder with the same prefix", async () => {
    expect(await statusOf("/..%2fpackage.json")).toBe(404);
    expect(await statusOf("/..%2fout-other%2fx")).toBe(404);
  });
});
