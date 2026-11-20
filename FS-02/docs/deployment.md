# Deployment guide

## Containers

```bash
cp .env.example .env
# replace all development secrets and provider values
docker compose up --build -d
docker compose run --rm api npm run db:seed # development only
```

The one-shot `migrate` service applies committed migrations before API health is required. Named volumes preserve PostgreSQL, Redis, and Elasticsearch data.

## Production topology

- Deploy `apps/web` static output to a CDN/Vercel; set `VITE_API_URL` at build time.
- Deploy the API image to a TLS-terminating Docker platform with at least two instances.
- Use managed PostgreSQL with PITR, managed Redis, managed Elasticsearch/OpenSearch, and private S3-compatible storage.
- Set cookie security for HTTPS, strict CORS origins, provider webhook URL, S3 CORS policy, and observability/alerting.
- Run `npm run db:migrate:deploy` as a release job before rolling API instances.

Required secrets: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, S3 credentials, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`. Never expose them as `VITE_*` variables.

Use Stripe Connect test mode to configure marketplace accounts before enabling settlement. The ledger records vendor earnings separately from actual provider payouts.
