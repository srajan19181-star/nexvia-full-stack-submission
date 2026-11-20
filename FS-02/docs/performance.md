# Performance report

## Implemented controls

- Route-level lazy chunks, lazy product images, reduced-motion support, TanStack Query caching, Redis caching, indexed PostgreSQL queries, pagination, debounced suggestions, and Elasticsearch projection.
- Search uses a durable leased outbox and PostgreSQL fallback; checkout never trusts search data for price or inventory.
- Production Vite build is split by route. The latest observed main chunk was approximately 682 kB minified / 211 kB gzip; further vendor splitting is a documented optimization opportunity.

## Measured local load sample

Recorded on **2026-11-19T11:57:00Z** against the full Docker stack with Elasticsearch serving search results.

| Metric | Measured value |
| --- | ---: |
| Virtual clients | 4 |
| Duration | 10 seconds |
| Client pacing | 100 ms |
| Requests | 329 |
| Success / failure | 329 / 0 |
| Throughput | 32.49 requests/second |
| p50 | 9.39 ms |
| p95 | 44.26 ms |
| p99 | 64.35 ms |
| Maximum | 141.46 ms |
| Elasticsearch search average | 38.77 ms |

Routes sampled: `/health`, `/ready`, `/api/v1/products?limit=12`, `/api/v1/categories`, and `/api/v1/search?q=vase`.

Reproduce with:

```bash
LOAD_CLIENTS=4 LOAD_DURATION_SECONDS=10 LOAD_INTERVAL_MS=100 npm run test:load
```

These are local development measurements with a small seeded dataset, not production capacity claims.

## Not measured

Lighthouse and field Core Web Vitals were not executed, so no performance score or LCP/CLS/INP percentile is claimed. Measure them on the final deployed environment with representative devices, data, network throttling, and third-party provider scripts.

