# Testing guide

## Automated suites

```bash
npm run typecheck
npm test
npm run test:e2e
npm run test:production-smoke
npm run build
npm audit --omit=dev
```

`npm test` covers shared validation/permissions, authentication, workspace/page CRUD, comments, sharing/history, durable Yjs persistence, WebSocket authorization, concurrent convergence, reconnect, restore, viewer denial, presence cleanup, restart recovery, and Redis multi-instance synchronization.

Playwright starts isolated API, collaboration, and Vite processes on ports 4100, 4101, and 4173. It applies migrations to `TEST_DATABASE_URL`, registers two users through the UI, creates a workspace/page, adds membership through the test fixture, types concurrently in two browser contexts, reconnects an offline editor, and verifies viewer read-only enforcement.

`npm run test:production-smoke` targets the running Docker/Nginx application on `http://localhost:5173`, verifies the landing page renders, and fails on unexpected browser runtime errors. This protects against production-only bundling failures that Vite development mode cannot expose.

## Load measurement

Create an editor session and target page, then provide the raw opaque session token from a controlled test environment:

```bash
LOAD_PAGE_ID=<page-cuid> \
LOAD_SESSION_TOKEN=<test-session-token> \
LOAD_CLIENTS=100 \
LOAD_REPORT_PATH=./test-results/load-100.json \
npm run test:load
```

For a self-contained local 25-client measurement against the isolated test database:

```bash
npm run test:load:sample
```

The latest recorded local measurement is in `docs/test-report-2026-11-17.md`. Treat it as a reproducible development baseline, not a production SLA.

Optional variables include `LOAD_COLLABORATION_URL`, `LOAD_WEB_ORIGIN`, `LOAD_DOCUMENT_GENERATION`, `LOAD_CONNECT_TIMEOUT_MS`, and `LOAD_CONVERGENCE_TIMEOUT_MS`. The runner reports measured connection latency percentiles, convergence time, final client count, update count, character count, run duration, and process RSS. It exits non-zero on timeout and never prints invented throughput.

Record hardware, network topology, service replica count, database/Redis configuration, commit, concurrency, and raw report using `docs/test-report-template.md`.
