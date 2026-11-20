# Testing guide

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis: `docker compose up -d postgres redis`.
3. Run `npm run db:migrate:deploy && npm run db:seed`.
4. Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.

API integration tests use the real development PostgreSQL database and verify catalog reads, invalid login, secure login, CSRF rejection, persistent cart mutation, customer/admin separation, approved-vendor access, and Elasticsearch fallback. Shared tests verify password rules, commission arithmetic, and order transitions. React Testing Library verifies accessible states. Playwright covers storefront-to-cart and admin metrics journeys.

Provider webhook tests require Stripe test fixtures and should set `STRIPE_WEBHOOK_SECRET`. Never weaken verification for tests; generate a signed event with Stripe CLI.

## Load testing template

No performance numbers are invented. For a measured run, record hardware, commit, dataset size, virtual users, duration, p50/p95/p99 latency, throughput, errors, database CPU, Redis hit rate, and Elasticsearch latency. Checkout load tests must use isolated products and reconcile reservations after the run.
