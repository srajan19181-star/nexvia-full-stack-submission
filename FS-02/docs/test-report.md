# Test report — 2026-11-18

## Executed and passed

- `npm run typecheck` — 4/4 workspaces passed.
- `npm run test -w @aureva/api` — 7/7 tests passed across infrastructure and real PostgreSQL integration suites.
- Final `npm test` gate — 11/11 tests passed: 7 API, 3 shared-domain, and 1 React component test.
- `npm run build` — shared, database, API, and web production builds passed.
- `node tests/e2e/smoke.mjs` — 2/2 real Chromium journeys passed: customer login/product/cart and admin protected metrics.
- Prisma migrations `initial` and `product-base-price` applied; seed completed.
- PostgreSQL 16 and Redis 7.4 container health checks passed.

## Not yet executed

- Standard `playwright test` specs are implemented, but the local Playwright test runner stalled before execution in this Windows shell. Direct Playwright Chromium automation passed both equivalent journeys.
- Full Docker build was not completed after the external Elasticsearch image download exceeded the local network window.
- Stripe signed-webhook, S3 upload, email delivery, and payout-provider tests require external test credentials.

This report deliberately separates implemented checks from executed checks.
