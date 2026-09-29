# ── Build stage ────────────────────────────────────────────────────────────
# Compiles @dmb/shared (TS -> dist) and the server (TS -> dist), so the runtime
# image only ever executes plain JavaScript from `dist/`.
FROM node:22-bookworm-slim AS build

# better-sqlite3 needs a toolchain when no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY server/package.json server/tsconfig.json ./server/
COPY client/package.json client/tsconfig.json ./client/
RUN npm install --workspace server --include-workspace-root

COPY shared ./shared
COPY server ./server
RUN npm run build --workspace @dmb/shared \
  && npm run build --workspace server

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/dist ./server/dist
COPY package.json ./

RUN mkdir -p /app/data
EXPOSE 3001

# `server/` is the cwd so DATABASE_URL (./data/...) and the .env lookup resolve
# inside the container.
WORKDIR /app/server
CMD ["node", "dist/index.js"]
