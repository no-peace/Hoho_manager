import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/**
 * Vitest config for the server.
 *
 * Mirrors tsconfig: `@dmb/shared` resolves to the shared **source**, so tests
 * run against the same code the server imports — no build step needed.
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
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    fileParallelism: false,
  },
});
