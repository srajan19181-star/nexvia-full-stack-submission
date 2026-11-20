# Deployment guide

## Container deployment

`docker compose up --build` provides a complete local topology, including a one-shot migration job that must succeed before API and collaboration startup. Production deployments should build the three service images independently and use managed PostgreSQL/Redis where available.

1. Build immutable web, API, and collaboration images.
2. Apply Prisma migrations once with `npm run db:migrate:deploy` before rolling application instances.
3. Run at least two API instances and two collaboration instances behind load balancers that preserve `Origin`, cookies, and WebSocket upgrades.
4. Terminate TLS at ingress; expose only HTTPS/WSS, not PostgreSQL or Redis.
5. Set strong independent session, CSRF, and internal collaboration secrets through a secret manager.
6. Configure `WEB_ORIGIN`, `APP_URL`, `VITE_API_URL`, and `VITE_COLLABORATION_URL` to exact public origins.
7. Configure SMTP; production API startup rejects log-only password reset delivery.
8. Monitor `/health/live` and `/health/ready`; drain instances on `SIGTERM`.

## Scaling and operations

- Collaboration instances require shared PostgreSQL and Redis.
- Redis loss increases synchronization latency but durable document recovery continues through periodic PostgreSQL replay; readiness exposes Redis fanout status.
- Back up PostgreSQL with point-in-time recovery. Redis contains no sole copy of document state.
- Alert on WebSocket close/error rates, replay lag, update persistence latency, room count, Redis reconnects, database pool saturation, and restore failures.
- Run load measurements against a staging topology matching production before changing replica counts.
- Rotate secrets by revoking sessions or performing a coordinated deployment as appropriate.

## Security checklist

- Secure cookies and trusted proxy settings are correct behind ingress.
- CORS and WebSocket origins contain only intended web origins.
- CSP is adjusted only for required asset/API hosts.
- Database and Redis credentials are unavailable to the web image.
- Request and WebSocket size limits are enforced at ingress and services.
- Logs exclude cookies, reset tokens, invitation tokens, and document payloads.
