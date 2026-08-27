FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY frontend ./frontend
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --gid 10001 auth && useradd --uid 10001 --gid auth --no-create-home --shell /usr/sbin/nologin auth \
    && mkdir -p /data && chown auth:auth /data

COPY --from=build --chown=auth:auth /app/package.json /app/package-lock.json ./
COPY --from=build --chown=auth:auth /app/node_modules ./node_modules
COPY --from=build --chown=auth:auth /app/dist ./dist

USER 10001:10001
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/server.js"]
