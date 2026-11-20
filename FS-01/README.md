# Orvyn Collaborative Workspace

Orvyn is a production-minded real-time workspace built with React, Express, PostgreSQL, Prisma, TipTap, Yjs, Redis, and strict TypeScript. It provides secure cookie sessions, nested workspaces and pages, convergent collaborative editing, awareness presence, anchored comments, immutable history, sharing controls, audit activity, and full-stack container deployment.

## Architecture

```text
apps/web            React/Vite product and marketing application
apps/api            Express REST API for identity and product metadata
apps/collaboration  Authenticated Yjs WebSocket and snapshot coordinator
packages/shared     Zod contracts and permission calculations
packages/database   Prisma schema, migrations, generated client, and seed
tests/e2e           Multi-context Playwright collaboration journey
tests/load          Configurable WebSocket virtual-client runner
docker              Service images and Nginx SPA configuration
docs                Architecture, protocol, API, testing, and deployment guides
```

PostgreSQL is authoritative for users, metadata, comments, snapshots, compacted Yjs state, and the ordered update log. Redis distributes low-latency invalidations and awareness between collaboration instances. Every document update is persisted before fanout; subscribers replay missing updates from PostgreSQL, and periodic reconciliation recovers missed Pub/Sub messages.

See [system architecture](docs/architecture.md), [data model](docs/data-model.md), [API reference](docs/api-reference.md), and [WebSocket protocol](docs/websocket-protocol.md).

## Prerequisites

- Node.js 22.12+
- npm 10+
- Docker with Compose

## Fresh-clone setup

```bash
cp .env.example .env
npm ci
npm run services:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Replace all example secrets in `.env`. The web application runs on `http://localhost:5173`, the REST API on `http://localhost:4000`, and collaboration on `ws://localhost:4001/collaboration`.

Demo users are seeded only when `NODE_ENV=development` and `SEED_DEMO_DATA=true`. Authentication tokens are never stored in browser local storage.

## Full Docker stack

```bash
docker compose up --build
```

This starts the web, API, collaboration, PostgreSQL, and Redis services with health checks. A one-shot migration job applies committed Prisma migrations before API and collaboration startup. For production, provide external secrets, SMTP, TLS termination, restricted network exposure, and production public URLs. See [deployment guide](docs/deployment.md).

## Required environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by API/collaboration/Prisma |
| `TEST_DATABASE_URL` | Isolated integration and Playwright database |
| `REDIS_URL` | Collaboration fanout and presence coordination |
| `SESSION_SECRET` | Keyed hashing secret for opaque session tokens |
| `CSRF_SECRET` | HMAC secret for double-submit CSRF proof |
| `COLLABORATION_INTERNAL_SECRET` | Signed API-to-collaboration snapshot requests |
| `WEB_ORIGIN` | Comma-separated CORS and WebSocket origin allowlist |
| `APP_URL` | Public web URL used in invitation/reset links |
| `VITE_API_URL` | Public REST base URL embedded in the web build |
| `VITE_COLLABORATION_URL` | Public WebSocket base URL embedded in the web build |

All supported variables and safe development defaults are documented in `.env.example`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start web, API, and collaboration processes |
| `npm run typecheck` | Strict TypeScript validation across workspaces |
| `npm test` | Unit and backend/collaboration integration tests |
| `npm run test:e2e` | Isolated two-browser-context Playwright journey |
| `npm run test:production-smoke` | Verify the Docker/Nginx landing build has no runtime errors |
| `npm run test:load` | Run configurable collaboration load measurement |
| `npm run test:load:sample` | Run an isolated 25-client local measurement |
| `npm run build` | Production build for every package and app |
| `npm run check` | Typecheck, unit/integration tests, and production build |
| `npm run db:migrate:deploy` | Apply committed migrations without creating new ones |

See [testing guide](docs/testing.md), [measured local report](docs/test-report-2026-11-17.md), and [test report template](docs/test-report-template.md).

## Security model

- Argon2id password hashing and expiring opaque sessions in secure HttpOnly cookies.
- HMAC-authenticated double-submit CSRF protection for state-changing REST requests.
- CORS and WebSocket origin allowlists, Helmet headers, CSP, bounded request/message sizes, and rate limits.
- Zod validation at shared transport boundaries and centralized sanitized errors.
- REST and WebSocket authorization for workspace, page, comments, history, and updates.
- Viewers can sync documents and awareness but update frames are rejected before persistence.
- Snapshot restores increment document generation and close stale clients before reconnect.

## Delivery records

Milestones 1–7 are documented in `docs/milestone-*-report.md`. Presentation and reflection templates are available in [presentation outline](docs/presentation-outline.md) and [reflection template](docs/reflection-template.md).
