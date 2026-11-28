# syntax=docker/dockerfile:1
# Acapela's room relay ("salas", relay/server.mjs) for Dokploy: a small Node
# server with no dependencies, nothing on disk. Traefik sends it
# acapela.app/sala/* (port 8090).
# Build:  docker build -t acapela-relay relay
# Run:    docker run -p 8090:8090 acapela-relay

FROM node:24-alpine
ENV NODE_ENV=production PORT=8090 TZ=America/Montevideo
WORKDIR /app
COPY server.mjs ./
USER node
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/sala/healthz || exit 1
CMD ["node", "server.mjs"]
