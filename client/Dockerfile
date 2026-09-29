# Production-style image: builds the SPA and serves `client/dist` with nginx.
# (Local development does not need this image — `npm run dev` is faster.)
FROM node:22-bookworm-slim AS build

# Base URL of the API, baked into the bundle at build time (Vite inlines all
# VITE_* vars). Empty means same-origin — set it when API and SPA host apart.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY client/package.json client/tsconfig.json ./client/
COPY server/package.json ./server/
RUN npm install --workspace client --include-workspace-root

COPY shared ./shared
COPY client ./client
# @dmb/shared resolves to source via the Vite alias, so no shared build needed.
RUN npm run build --workspace client

FROM nginx:1.27-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
# SPA fallback: every unknown path serves index.html.
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
