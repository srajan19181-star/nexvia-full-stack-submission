# Test report — 2026-11-20

## Executed and passed

| Gate | Result |
| --- | --- |
| `npm run typecheck` | All workspaces passed strict TypeScript checks |
| `npm run lint` | Passed with zero warnings |
| `npm test` | 39 passed: 23 API, 15 shared-domain, 1 React Testing Library |
| `npm run build` | Shared, database, API, and route-split web production builds passed |
| `PLAYWRIGHT_EXTERNAL_SERVERS=1 npm run test:e2e` | 5/5 Chromium journeys passed against the Docker stack |
| `npm run test:storage` | Presign, PUT, HEAD completion, public GET, byte comparison, and cleanup passed |
| `npm run test:load` | 329/329 requests passed in the recorded local sample |
| `docker compose config --quiet` | Compose configuration valid |

## Covered behavior

- Authentication: valid/invalid login, cookie sessions, expired token rejection, CSRF, role separation, and vendor ownership.
- Catalog and products: public reads, validation, creation/update, moderation, upload validation, filters, and reserved vendor routes.
- Commerce: cart persistence, authoritative totals, coupons, insufficient stock, concurrent reservation of the final unit, multi-vendor splitting, commissions, and state transitions.
- Payments: signed/invalid/duplicate webhooks, failed payment, successful payment, partial refund, idempotency, inventory commit, and commission reversal.
- Operations: returns, refunds, reviews, support, coupons, settings, customer status, categories/attributes, payout ledger, and audit paths.
- Browser journeys: customer catalog/cart drawer, vendor products/analytics, admin metrics/customer management, 390 px mobile navigation, and Axe WCAG A/AA checks on `/`, `/products`, and `/login`.
- Infrastructure: PostgreSQL/Redis readiness, Elasticsearch-backed search, PostgreSQL search fallback, S3-compatible object verification, migration job, and all service health checks.

## Environment

- Windows 11 host with Docker Desktop
- Node.js 22 toolchain
- PostgreSQL 16, Redis 7.4, Elasticsearch 8.17.4, Adobe S3Mock 5.1
- Chromium supplied by Playwright

## External checks not claimed

- No live Stripe, Resend, carrier, or production cloud credentials were used.
- No Lighthouse or field Core Web Vitals result was measured.
- The local load sample is not a production SLA or capacity forecast.

