# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build

WORKDIR /app
ARG VITE_API_URL=http://localhost:4000/api/v1
ARG VITE_COLLABORATION_URL=ws://localhost:4001/collaboration
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_COLLABORATION_URL=$VITE_COLLABORATION_URL

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/collaboration/package.json apps/collaboration/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build:packages && npm run build -w @nexvia/web

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz || exit 1
