# syntax=docker/dockerfile:1
# Imagen de producción para Dokploy (VPS IDC).
# Acapela es una SPA 100 % estática (ssr: false): se genera con `nuxt generate`
# y la sirve nginx (sin root, puerto 8080). No necesita variables de entorno.
# Build:  docker build -t acapela .
# Run:    docker run -p 8080:8080 acapela

ARG NODE_VERSION=24

# ---- build ---------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

# Misma versión de pnpm que packageManager en package.json.
RUN npm install -g pnpm@10.15.0 && pnpm --version

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm fetch --frozen-lockfile

COPY . .
# Sin scripts de ciclo de vida: `prepare` instala hooks de git (no hay .git en la
# imagen) y `postinstall` (`nuxt prepare`) lo hace igual `nuxt generate`.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --offline --frozen-lockfile --ignore-scripts

# El índice de himnarios se regenera con los .txt que haya en public/songs/, y
# las Biblias con las bases que haya en data/biblias/ (ver su README).
ENV NODE_ENV=production
RUN node scripts/generate-songbook-manifest.mjs && node scripts/build-bibles.mjs && pnpm exec nuxt generate
# Las Biblias (7-25 MB cada una) van también comprimidas: nginx sirve el .gz
# a quien lo acepta (gzip_static) y se descarga menos de la mitad.
RUN find .output/public/bibles -name '*.sqlite' -exec gzip -k -9 {} \;

# ---- runtime -------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
ENV TZ=America/Montevideo

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/.output/public /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
