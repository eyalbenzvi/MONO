import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // React components in tests (per-file `// @vitest-environment jsdom`).
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: [
      // Tests read the index synchronously from data/ (the app fetches it: lib/catalogIndex).
      { find: "@/lib/catalogIndex", replacement: fileURLToPath(new URL("./lib/catalogIndex.node.ts", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
    ],
  },
  test: { include: ["tests/**/*.test.{ts,tsx}"], environment: "node" },
});
