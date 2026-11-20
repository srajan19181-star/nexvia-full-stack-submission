# AUREVA

AUREVA is a production-oriented multi-vendor marketplace monorepo. It provides a responsive React storefront, customer cart and checkout flow, vendor operations, admin moderation, secure cookie authentication, PostgreSQL persistence, Redis caching, Elasticsearch projection, S3 presigned uploads, Stripe test-mode boundaries, PDF invoices, automated tests, and Docker deployment.

## Architecture

- `apps/web` — React 19, TypeScript, Vite, Tailwind CSS, Motion, GSAP, TanStack Query, React Hook Form.
- `apps/api` — Express 5 REST API, JWT cookie sessions, CSRF, RBAC, Stripe webhooks, PDFKit, S3 presigning.
- `packages/database` — Prisma 7 client, normalized PostgreSQL schema, migrations, realistic seed.
- `packages/shared` — Zod contracts, order state machine, integer-money helpers, commission rules.
- `tests/e2e` — Playwright customer and admin browser journeys.
- `docs` — architecture, ERD, API, testing, security, deployment, performance, and presentation material.

See `docs/architecture.md` and `docs/er-diagram.md` for Mermaid diagrams.

## Quick start

Prerequisites: Node.js 22+, npm 10+, Docker Desktop.

```bash
cp .env.example .env
npm ci
npm run db:generate
docker compose up -d --build
npm run db:seed
```

Open `http://localhost:5174`. The API is at `http://localhost:4100`, health at `/health`, and readiness at `/ready`.

Compose starts the web, API, one-shot migration job, PostgreSQL, Redis, Elasticsearch, and development-only S3Mock services with health checks. The API automatically falls back to PostgreSQL search if Elasticsearch is unavailable. Real Stripe and production object storage require the external credentials described in `docs/deployment.md`.

## Demo accounts

Development seed only; all use password `AurevaDemo2026!`:

- Customer: `customer@aureva.local`
- Approved vendor: `vendor@aureva.local`
- Second approved vendor: `vendor2@aureva.local`
- Administrator: `admin@aureva.local`

Never seed these accounts in a production database.

## Commands

```bash
npm run typecheck             # strict TypeScript
npm test                      # unit + API integration tests
npm run test:e2e             # Playwright browser journeys
npm run test:storage         # S3-compatible upload verification
npm run test:load            # configurable local HTTP load sample
npm run build                 # all production builds
npm run db:migrate            # create development migration
npm run db:migrate:deploy     # apply committed migrations
npm run db:seed               # development fixtures
docker compose up --build     # full container stack
```

## Implemented workflows

- Rotated refresh sessions and short-lived access JWTs in HttpOnly cookies; no auth token in localStorage.
- Double-submit CSRF protection, Argon2id, role checks, vendor ownership checks, rate limiting, structured redacted logs.
- Public catalog, categories, vendor directory/storefronts, search/filter/sort/pagination, responsive product details.
- Persistent PostgreSQL cart with Redis cache, inventory validation, addresses, wishlist, account, and order views.
- Serializable checkout creates a parent order, per-vendor orders, reservations, commissions, and pending payment.
- Stripe PaymentIntent boundary and signature-verified idempotent webhooks; no simulated successful payment.
- Vendor application, admin approval, product creation/moderation, inventory, vendor-order fulfilment state machine.
- PostgreSQL search outbox with retries and Elasticsearch indexing; PostgreSQL remains authoritative.
- Verified-purchase review enforcement, coupons, notifications/support storage, audit logs, PDF order invoices.
- Warm editorial design system, responsive navigation, reduced-motion support, loading/empty/error states.

## External configuration

Live Stripe payment confirmation requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from a Stripe test account. Local presigned uploads use S3Mock; production requires a real S3-compatible endpoint and bucket. Tax rules, seller legal details, shipping carriers, email delivery, and payout onboarding require production providers and jurisdiction-specific configuration; the project does not invent those values.

## Current verification

Typecheck, lint, database migrations, seed, 39 unit/integration tests, 5 Playwright journeys, production builds, the full Docker stack, Elasticsearch search, and an S3-compatible upload round trip have been executed locally. See `docs/test-report.md` for exact results and limitations.
