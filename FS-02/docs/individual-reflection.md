# Individual Reflection — Srajan

## Ownership

I owned AUREVA end to end: marketplace domain design, normalized Prisma schema, secure authentication and RBAC, customer storefront, vendor and administrator portals, cart and checkout services, inventory reservations, commissions, provider integrations, testing, Docker deployment, and documentation. I designed PostgreSQL as the commerce source of truth while Redis, Elasticsearch, S3-compatible storage, and Stripe remain replaceable operational boundaries.

## Most Difficult Challenge

The hardest problem was preserving transactional correctness across a multi-vendor checkout. The server must derive prices and totals, reserve limited inventory atomically, split one checkout into vendor orders, calculate commissions in integer minor units, and avoid duplicate payment effects. I used serializable database transactions, explicit reservation records, state-machine validation, signed idempotent webhook handling, and audit records instead of trusting browser totals or provider retries.

Search introduced a different consistency challenge. PostgreSQL remains authoritative, and a leased retryable outbox projects changes into Elasticsearch. This avoids making checkout depend on an eventually consistent search index and provides a PostgreSQL fallback when Elasticsearch is unavailable.

## Learning

I learned to model money, inventory, order state, refunds, and vendor ownership as server-enforced domain rules rather than UI behavior. I gained practical experience with rotating HttpOnly cookie sessions, CSRF protection, presigned upload verification, webhook signatures, search outboxes, Docker health dependencies, browser accessibility checks, and measured load testing.

## Evidence and Results

The latest verification passed strict type checking, linting, 39 unit/integration tests, five Playwright journeys, all production builds, an S3-compatible upload round trip, and Elasticsearch-backed search. The recorded local load sample completed 329 of 329 requests at 32.49 requests/second with a 44.26 ms p95. These are reproducible local results, not production capacity claims; details are in the [test report](test-report.md) and [performance report](performance.md).

## What I Would Improve Next

With more time, I would deploy managed production services, connect verified Stripe and email test accounts, add jurisdiction-specific tax and carrier integrations, expand webhook and failure-injection tests, add OpenTelemetry dashboards, and run longer staged load tests against production-like data volumes.
