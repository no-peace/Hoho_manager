/// <reference types="vite/client" />

/**
 * Environment variables exposed to the browser.
 *
 * Anything prefixed with VITE_ is inlined into the bundle and is public.
 * Never put Discord bot tokens, OAuth secrets, or other server secrets here.
 * VITE_ADMIN_API_KEY is a local-development convenience only.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_API_KEY?: string;
  readonly VITE_STAFF_DISCORD_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
