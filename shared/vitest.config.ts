import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/**
 * Vitest configuration for `@dmb/shared`.
 *
 * Direct alias allows shared modules and tests to import `@dmb/shared` or `@/...`
 * directly from source.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@dmb/shared": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: false,
  },
});
