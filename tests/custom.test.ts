import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIB = path.resolve(__dirname, "..", "lib", "custom");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []));

describe("personalised prints: lib/custom is shared by the generator and the browser", () => {
  it("imports nothing from Node (it runs in the browser too)", () => {
    for (const f of files(LIB)) expect(readFileSync(f, "utf8"), path.relative(LIB, f)).not.toMatch(/from "node:|require\(/);
  });
});
