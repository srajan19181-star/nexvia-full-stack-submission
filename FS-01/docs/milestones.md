# Delivery milestones

| Milestone | Deliverable | Verification gate |
| --- | --- | --- |
| 1 | Monorepo, design system, full schema, sessions, reset flow | auth integration tests, typecheck, builds |
| 2 | Workspaces, roles, invitations, page tree, dashboard CRUD | REST authorization and CRUD integration tests |
| 3 | TipTap feature set and durable local Yjs state | editor unit tests and restart persistence test |
| 4 | Authenticated Yjs WebSocket synchronization | convergence, reconnect, and write-denial tests |
| 5 | Awareness presence, cursors, connection states | multi-client presence and stale cleanup tests |
| 6 | Relative-position comments, snapshots, restore, sharing | permission matrix and restore convergence tests |
| 7 | Redis gap recovery, multi-instance tests, Docker, security and docs | Compose smoke test, Playwright, load test report |

Every gate must pass before its milestone is described as complete. Load-testing documentation records the command, hardware, concurrency, duration, and measured output; it never substitutes invented throughput figures.

All seven milestones are implemented. Verification details for the final phases are in `milestone-6-report.md` and `milestone-7-report.md`.
