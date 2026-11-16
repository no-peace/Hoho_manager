# HoHo Manager

## Run the website locally (Windows)

The website needs the Express API and Vite client. You do **not** need to run the Discord bot just to work on the UI.

### Requirements

- Node.js 22–26 (Node.js 22 LTS or newer is recommended)
- npm (installed with Node.js)

Check versions in PowerShell:

```powershell
node -v
npm -v
```

### 1. Install dependencies

Open PowerShell in the repository root (the folder containing the root package.json):

```powershell
npm install
```

### 2. Create local environment files

Copy the templates:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Open server/.env and make sure these values are set:

```env
NODE_ENV=development
DEV_AUTH_BYPASS=true
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
ADMIN_API_KEY=dev-admin-key
```

In client/.env, use the matching key and leave the API URL empty:

```env
VITE_ADMIN_API_KEY=dev-admin-key
VITE_API_BASE_URL=
```

You can use Local Developer login without Discord OAuth credentials. Leave Discord fields blank unless you need real Discord features such as guild lookup, bot sending, or interactions.

### 3. Start the website and API

From the repository root, run:

```powershell
npm run dev:web
```

This builds the shared package, then starts the API and frontend together. It deliberately does **not** start the Discord gateway bot.

Open the website:

- Frontend: http://localhost:5173
- API health check: http://localhost:3001/api/health

Use **Continue as Local Developer** on the login screen. Stop both processes with Ctrl+C in the terminal.

### Optional: run the Discord bot too

The bot is not needed for UI development. To run it, copy bot/.env.example to bot/.env, add your DISCORD_BOT_TOKEN, and ensure its ADMIN_API_KEY matches server/.env. Then run:

```powershell
npm run dev
```

The full command starts the API, client, and bot. Never commit your .env files or share their secrets.

## Environment files

- server/.env.example: API, database, Discord credentials, OAuth, session/security settings, and local developer login.
- client/.env.example: browser API URL and development-only API key.
- bot/.env.example: Discord gateway token and API connection settings.

The .env.example files are templates. Copy them to the corresponding .env files and edit the local copies.
