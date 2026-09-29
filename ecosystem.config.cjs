/**
 * PM2 ecosystem file.
 *
 *   npm i -g pm2
 *   npm run build                 # shared -> client -> server (+ bot)
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup       # survive reboots
 *
 * Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/
 *
 * ── Why fork mode, not cluster ────────────────────────────────────────────────
 * PM2's `exec_mode: "cluster"` (`-i max`) load-balances across CPU cores, but it
 * starts *several OS processes*. This app stores its data in a single SQLite file
 * via better-sqlite3, which is a synchronous, single-process embedded database:
 * two writers on one file is how you get `SQLITE_BUSY` and, eventually, a corrupt
 * database. So the API runs as exactly one forked process.
 *
 * Scale the API horizontally **only after** moving off SQLite onto Postgres —
 * `server/src/repositories/` is the swap point (see docs/DEPLOYMENT.md §9).
 */

const path = require("node:path");

const root = __dirname;

/** Shared defaults so every app behaves the same under PM2. */
const base = {
  cwd: root,
  // Restart a process that balloons instead of letting the host OOM-kill it.
  max_memory_restart: "400M",
  // Give the process time to finish in-flight interactions before SIGKILL.
  kill_timeout: 10000,
  // Our own logger timestamps, but PM2's are what end up in the log file.
  time: true,
  log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  merge_logs: true,
  autorestart: true,
  // Crashes in a tight loop usually mean bad config; don't thrash forever.
  max_restarts: 16,
  min_uptime: "10s",
  restart_delay: 4000,
};

module.exports = {
  apps: [
    {
      ...base,
      name: "dmb-api",
      // Built output. Run `npm run build:server` first.
      script: path.join("server", "dist", "index.js"),
      cwd: path.join(root, "server"),
      // SQLite: exactly one instance. See the note at the top of this file.
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      // Uncomment to let PM2 watch the source during development instead of
      // using `npm run dev` (which has its own watcher).
      // watch: path.join(root, "server", "src"),
      // ignore_watch: ["node_modules", "data"],
    },

    {
      ...base,
      name: "dmb-web",
      // Vite's preview server hosts the built SPA. Swap for nginx if you prefer
      // a real static host; the only requirement is that it can reach the API.
      script: path.join("node_modules", "vite", "bin", "vite.js"),
      cwd: path.join(root, "client"),
      args: "preview --port 5173 --host 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      // The SPA is static files; a leak here would be Vite's, not ours.
      max_memory_restart: "300M",
    },

    // ──────────────────────────────────────────────────────────────────────────
    // The Sapphire gateway bot: slash commands, member events, and the
    // interaction *relay*.
    //
    // Required whenever the host has no public HTTPS address (no Cloudflare
    // Tunnel): with the Developers Portal's Interactions Endpoint URL cleared,
    // this worker is the only way button clicks reach the API. With an endpoint
    // URL set it is optional, and only adds slash commands.
    //
    // Uncomment after `npm install` has pulled in the workspace and
    // `npm run build:bot` has produced `bot/dist`.
    // ──────────────────────────────────────────────────────────────────────────
    // {
    //   ...base,
    //   name: "dmb-gateway",
    //   script: path.join("bot", "dist", "index.js"),
    //   cwd: path.join(root, "bot"),
    //   instances: 1,
    //   exec_mode: "fork",
    //   env: { NODE_ENV: "production" },
    // },

    // ──────────────────────────────────────────────────────────────────────────
    // Optional: Cloudflare Tunnel, so the site is reachable on a real domain
    // without a public inbound port. Only usable where a `cloudflared`
    // credential exists on this host — in this project's setup that is the
    // laptop only, not the server. See docs/PTERODACTYL_DEPLOYMENT.md §7.
    //
    // `cloudflared` is a Go binary, not a Node script — PM2 can still supervise
    // it. Set `interpreter: "none"` so PM2 does not wrap it in Node.
    // ──────────────────────────────────────────────────────────────────────────
    // {
    //   ...base,
    //   name: "dmb-tunnel",
    //   script: "/usr/local/bin/cloudflared",
    //   interpreter: "none",
    //   args: "tunnel --config /etc/cloudflared/config.yml run",
    //   max_memory_restart: "150M",
    // },
  ],
};
