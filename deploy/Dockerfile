FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY apps ./apps
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=/api
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app /app
RUN mkdir /data && chown node:node /data
USER node

FROM runtime AS api
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]

FROM runtime AS web
WORKDIR /app/apps/web
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
