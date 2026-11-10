import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/**
 * Vitest configuration for `bot`.
 *
 * Mirrors `server/vitest.config.ts`: `@dmb/shared` resolves directly to shared
 * source, and `@` points to `bot/src/`.
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
    passWithNoTests: false,
  },
});
