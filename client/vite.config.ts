import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const LOCAL_API_URL = "http://127.0.0.1:3001";
/**
 * Vite configuration.
 *
 * - `@` aliases the client source root so imports stay short.
 * - `@dmb/shared` points at the shared package's **source**, so editing a shared
 *   constant is picked up by HMR without rebuilding that package. Vite compiles
 *   TypeScript itself, so no build step is needed here.
 * - In development, `/api` is proxied to the Express server so the browser never
 *   needs CORS and the frontend can use relative URLs.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@dmb/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Files above the project root (../shared) must be explicitly allowed.
    fs: { allow: [".."] },
    proxy: {
      "/api": {
        target: LOCAL_API_URL,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("gsap") || id.includes("motion")) return "vendor-motion";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("emoji-mart") || id.includes("@emoji-mart") || id.includes("chrono-node")) {
            return "vendor-pickers";
          }
          if (id.includes("react") || id.includes("zustand") || id.includes("sileo")) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
});
