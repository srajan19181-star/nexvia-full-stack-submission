# Individual Reflection — Srajan

## Ownership

I owned Orvyn end to end: monorepo structure, product UI, authentication, workspace and page APIs, the Yjs collaboration gateway, PostgreSQL persistence, Redis coordination, comments, history, permission enforcement, automated tests, Docker configuration, and technical documentation. I kept shared Zod contracts and permission calculations in reusable packages so the REST API, collaboration service, and web client use consistent rules.

## Most Difficult Challenge

The hardest problem was making real-time editing durable and secure without weakening CRDT convergence. Yjs awareness is intentionally ephemeral, while document updates must survive disconnects, restarts, and missed Redis messages. I separated those responsibilities: PostgreSQL stores compacted binary document state and an ordered update log, while Redis provides low-latency cross-instance notification and presence. Collaboration instances replay missing durable updates instead of treating Pub/Sub as a source of truth.

Authorization also had to be enforced at the WebSocket boundary. A read-only client can receive document and awareness state, but incoming mutation frames are rejected before persistence. Snapshot restore advances the document generation and forces clients to reconnect so every participant converges on the restored state without deleting earlier history.

## Learning

I learned how Yjs updates, state vectors, awareness, and relative positions solve different collaboration problems. I also gained practical experience with secure HttpOnly sessions, CSRF protection, origin validation, graceful shutdown, database-backed recovery, and multi-service integration testing. The project reinforced that correctness must be enforced on the server even when the interface already hides restricted actions.

## Evidence and Results

The latest verification passed 44 unit and integration tests across the API, collaboration service, shared package, and web app. The complete five-service Docker stack reported healthy. A 25-client collaboration sample converged all updates; exact local measurements and limitations are recorded in the [test report](test-report-2026-11-17.md).

## What I Would Improve Next

With more time, I would add managed production deployment, OpenTelemetry traces and dashboards, chaos tests for Redis/PostgreSQL interruptions, larger multi-region soak tests, and browser recordings that explicitly show two simultaneous editors, viewer denial, reconnect recovery, and snapshot restoration.
