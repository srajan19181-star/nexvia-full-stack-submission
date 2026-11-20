# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/collaboration/package.json apps/collaboration/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build:packages && npm run build -w @nexvia/api

FROM build AS migration
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate:deploy"]

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund --workspace @nexvia/api --workspace @nexvia/database --workspace @nexvia/shared --include-workspace-root=false

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/database/dist packages/database/dist
COPY --from=build /app/packages/database/generated packages/database/generated
COPY --from=build /app/packages/shared/dist packages/shared/dist

EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
