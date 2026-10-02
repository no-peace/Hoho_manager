# Discord Message Builder

A full-featured Discord message builder website — Discohook-style visual editing for classic
embeds **and** Components V2, plus a real action system so the buttons and selects you design
actually *do* things (add roles, send DMs, open modals, start threads, chain multi-step flows).

Built for the web first: you design and send messages from the site, not slash commands.

> The interface deliberately mirrors [Discohook](https://discohook.app): the same `#1E1F22`
> chrome, rounded-lg controls, and a vertical tab rail. Interactive components get a second
> **Flow** tab where you build the ordered chain of actions a click should run.

## Stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Frontend  | Vite + React + Tailwind CSS + Zustand                         |
| Backend   | Node.js + Express + `discord-interactions`                    |
| Database  | SQLite via `better-sqlite3`, hidden behind a repository layer |
| Gateway   | Optional: Node.js + [Sapphire](https://sapphirejs.dev) + discord.js (`bot/`) |
| Language  | TypeScript everywhere (strict mode, ESM)                      |

## How sending works

| Mode          | Path                                | Why                                            |
| ------------- | ----------------------------------- | ---------------------------------------------- |
| Webhook URL   | Browser → Discord directly          | Webhook URLs are public by design, so it's safe |
| Bot Token     | Browser → `POST /api/send` → Discord| The bot token never leaves the server          |

Bot sending and profile management require the server's `x-admin-key`. The development client can
send this key from `client/.env`, but it must **not** be built into a public frontend bundle. This
project does not yet have user login/session authentication, so production bot workflows require
a private/trusted frontend or a real authentication layer; webhook sends from the browser remain
available without that key.

Interactions (button/select/modal clicks) reach the action system one of two ways, and the two are
**mutually exclusive per application** — Discord picks based on the app's *Interactions Endpoint
URL*:

| | Endpoint URL set | Endpoint URL empty |
| --- | --- | --- |
| Delivery | Discord POSTs to `POST /api/interactions` | `INTERACTION_CREATE` over the Discord gateway |
| Needs a public HTTPS address | yes (tunnel or real deploy) | **no** |
| Handled by | the Express API, after Ed25519 signature verification | the `bot/` worker, which **relays** the click to `POST /api/interactions/relay` over localhost |

Both routes converge on the same `handleInteraction()`, so a flow behaves identically either way.
The relay exists for hosts with **no public address** — a Cloudflare Tunnel is not always available
(it is laptop-only in this project's setup), and the gateway is an *outbound* WebSocket, so it works
from anywhere.

## Action flows

Every button and select can run an ordered **flow** — steps execute top to bottom and stop at the
first one that produces a visible reply:

```
Add role  →  Check  ┬─ Then → Send DM → Stop
                    └─ Else → Ephemeral reply
```

Available steps: `add_role`, `remove_role`, `toggle_role`, `send_dm`, `send_ephemeral_reply`,
`send_message`, `send_webhook_message`, `open_modal`, `delete_message`, `create_thread`, `wait`,
`set_variable`, `check`, `stop`.

Three of those mirror Discohook closely:

- **`check`** compares values (`equals`, `in`, `and`, `or`, `not`, with `{variable}` or
  `{{variable}}` and dotted paths) and holds two nested step lists, **Then** and **Else**. Branches nest arbitrarily; the
  executor refuses to recurse past 10 levels.
- **`set_variable`** has three modes — `static` (a literal), `adaptive` (a field of the interaction,
  e.g. `user.id` or the selected values), and `get` (mirror a variable by name).
- **`stop`** ends the flow, optionally with a message. It is how a branch says "done" without
  falling through into whatever follows the check.

A `custom_id` is capped at 100 characters, far too small for a chain, so only the first step's
parameters ride inline there. Longer flows are registered on the server:

- **Templates** persist their flows in `action_definitions` when you save.
- **Ad-hoc sends** ship their flows with the request; `POST /api/send` registers them against the
  returned message ID before acknowledging the send (`mode: "bot"` only for the browser's direct
  send path — direct webhook sends never touch your server).

That precedence matters: a flow registered at send time wins over a template's stored steps, so
re-sending a template ad-hoc never doubles its actions.

Dynamic variables resolve while an interaction flow runs. They cannot refer to a clicker in the
initial message sent before anyone clicks.

## Project layout

```
.
├── client/                    Vite + React SPA (the visual editor + live preview)
├── server/                    Express API, interaction endpoint, SQLite persistence
├── bot/                       Sapphire gateway worker (slash commands + interaction relay)
├── shared/                    Code shared by all of the above (`@dmb/shared`)
├── ecosystem.config.cjs       PM2 process definitions (API + web + optional gateway/tunnel)
├── tunnel/config.yml.example  cloudflared ingress rules for port-free hosting
├── docs/                      Setup + hosting guides
└── project_architecture_plan.md   The full architecture + phased roadmap
```

## Quick start

```bash
# 1. Install everything (npm workspaces installs client + server)
npm install

# 2. Configure the server
cp server/.env.example server/.env     # then fill in your Discord values

# 3. Configure the client (defaults are fine for local dev)
cp client/.env.example client/.env

# 4. Create the SQLite database + seed the local admin user
npm run migrate

# 5. Run both the API and the editor
npm run dev
```

- Editor: http://localhost:5173
- API:    http://localhost:3001/api/health

## Pointing Discord at the backend

In the Discord Developer Portal, set your application's **Interactions Endpoint URL** to:

```
https://<your-public-backend>/api/interactions
```

Discord will immediately send a signed `PING`; the endpoint verifies the Ed25519 signature with
your **Public Key** and replies with a `PONG`. If that fails, the URL is rejected.

For local development, expose the server with a tunnel (e.g. `cloudflared tunnel --url
http://localhost:3001`) and use that public URL — see
[`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md) for the full walkthrough.

The `bot/` workspace is **optional if you have a public URL, required if you do not**. It provides
slash commands (`/ping`, `/status`, `/server`, `/send`) and, when the Interactions Endpoint URL is
left empty, relays button clicks to the API over localhost so a host with no public address can
still run flows. It talks to the API over HTTP rather than opening the database itself, so there is
still exactly one bot token on disk and exactly one SQLite writer.

```bash
cp bot/.env.example bot/.env     # DISCORD_BOT_TOKEN, API_BASE_URL, ADMIN_API_KEY, DEV_GUILD_ID
npm run dev:bot                  # or `npm run start:bot` after a build
```

## Guides

- **New here?** Start with [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md) — a
  from-zero guide to running and testing everything locally.
- **Ready to go live?** [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — recommended hosts,
  environment variable checklist, and Discord Developer Portal setup.
- **Running in a Pterodactyl container (or any host with one open port)?**
  [`docs/PTERODACTYL_DEPLOYMENT.md`](./docs/PTERODACTYL_DEPLOYMENT.md) — PM2 supervision, the
  gateway relay for hosts with **no** public address, and (as an alternative) a Cloudflare Tunnel.
- **The gateway worker:** [`bot/README.md`](./bot/README.md).

## Phases

Phase 1 (core editor, preview, webhook sending), the Phase 2 backend foundation
(`/api/send`, `/api/interactions`, persistence) and the Phase 3 action system — including the
Discohook-style multi-step **Flow** builder with branching (`check` / `stop` / `set_variable`), plus
the gateway worker and its interaction relay — are implemented. See
[`project_architecture_plan.md`](./project_architecture_plan.md) for the full roadmap.
