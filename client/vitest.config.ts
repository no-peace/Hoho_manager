import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest config for the client.
 *
 * Mirrors `vite.config.ts`: `@dmb/shared` resolves to the shared **source** and
 * `@` to the client src root, so tests run against the same code Vite bundles.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@dmb/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
