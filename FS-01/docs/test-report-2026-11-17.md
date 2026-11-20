# Test report — 2026-11-17

## Environment

- Windows 11 Home Single Language
- 12th Gen Intel Core i5-12450HX
- 11.8 GB physical memory
- Node.js 24.11.1 and npm 11.6.2
- Local PostgreSQL and Redis services
- One API process, one collaboration process, and 25 authenticated virtual clients

## Measured collaboration load sample

Command: `npm run test:load:sample`

| Measurement | Result |
| --- | ---: |
| Connected clients | 25 / 25 |
| Concurrent updates | 25 |
| Synchronization latency minimum | 505.28 ms |
| Synchronization latency p50 | 985.23 ms |
| Synchronization latency p95 | 1357.28 ms |
| Synchronization latency p99 | 1395.83 ms |
| Update convergence | 984.91 ms |
| Total run | 2391.78 ms |
| Load-client process RSS | 74,436,608 bytes |

All clients observed all 25 update markers. These are local development measurements, not production capacity claims. The raw JSON artifact is written to `test-results/collaboration-load-25.json` when the command runs.
