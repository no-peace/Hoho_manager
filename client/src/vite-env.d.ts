/// <reference types="vite/client" />

/**
 * Environment variables exposed to the browser.
 *
 * Anything prefixed `VITE_` is inlined into the bundle at build time, so it must
 * never hold a secret. `VITE_ADMIN_API_KEY` is a local-development convenience
 * only — see the deployment guide for how to replace it with real auth.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
