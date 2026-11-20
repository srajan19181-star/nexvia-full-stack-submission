# Live Deployment — Both Projects

The fastest complete deployment is one Ubuntu VPS running both Docker Compose stacks behind Caddy. Use a server with at least 4 vCPU, 8 GB RAM, and 40 GB storage for the two PostgreSQL instances, Redis instances, Elasticsearch, S3Mock, application containers, and image builds. This is a practical demo/staging baseline, not a measured production capacity recommendation.

## 1. Prepare DNS and the Server

Create these DNS `A` records pointing to the VPS public IP:

- `orvyn.example.com`
- `aureva.example.com`
- `files.aureva.example.com`

Replace every `example.com` value below with the real domain. Permit inbound TCP `22`, `80`, and `443` only. Install Docker Engine with the Compose plugin and install Caddy from their official Ubuntu repositories.

```bash
git clone https://github.com/srajan19181-star/nexvia-full-stack-submission.git
cd nexvia-full-stack-submission
```

## 2. Configure Orvyn

```bash
cd FS-01
cp .env.example .env
openssl rand -hex 32
```

Edit `.env` and set at least:

```dotenv
NODE_ENV=production
LOG_LEVEL=info
WEB_ORIGIN=https://orvyn.example.com
APP_URL=https://orvyn.example.com
POSTGRES_PASSWORD=<new-hex-secret>
SESSION_SECRET=<different-new-hex-secret>
CSRF_SECRET=<different-new-hex-secret>
COLLABORATION_INTERNAL_SECRET=<different-new-hex-secret>
TRUST_PROXY=true
VITE_API_URL=https://orvyn.example.com/api/v1
VITE_COLLABORATION_URL=wss://orvyn.example.com/collaboration
MAIL_TRANSPORT=smtp
MAIL_FROM="Orvyn Workspace <no-reply@your-domain.com>"
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
SEED_DEMO_DATA=false
```

Start the stack. The one-shot `migrate` service applies committed migrations automatically.

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4000/health/ready
curl -fsS http://127.0.0.1:4001/health/ready
cd ..
```

Do not enable development demo seeds on a production database. Register the evaluator account through the UI instead.

## 3. Configure AUREVA

```bash
cd FS-02
cp .env.example .env
openssl rand -hex 32
```

Edit `.env` and set at least:

```dotenv
NODE_ENV=production
WEB_URL=https://aureva.example.com
CORS_ORIGINS=https://aureva.example.com
POSTGRES_USER=aureva
POSTGRES_PASSWORD=<new-hex-secret>
POSTGRES_DB=aureva
JWT_ACCESS_SECRET=<different-new-hex-secret>
JWT_REFRESH_SECRET=<different-new-hex-secret>
COOKIE_SECRET=<different-new-hex-secret>
CARRIER_WEBHOOK_SECRET=<different-new-hex-secret>
SEED_DEMO_PASSWORD=<private-password-with-at-least-12-characters>
TRUST_PROXY_HOPS=1
VITE_API_URL=https://aureva.example.com/api/v1
S3_PUBLIC_ENDPOINT=https://files.aureva.example.com
STRIPE_CONNECT_RETURN_URL=https://aureva.example.com/vendor-portal/payouts?connect=complete
STRIPE_CONNECT_REFRESH_URL=https://aureva.example.com/vendor-portal/payouts?connect=refresh
```

Start and seed the isolated evaluation environment. The seeded customer, vendor, and administrator accounts all use the private `SEED_DEMO_PASSWORD`; do not publish it in the repository or screenshots.

```bash
docker compose up -d --build
docker compose run --rm migrate npm run db:seed
docker compose ps
curl -fsS http://127.0.0.1:4100/ready
cd ..
```

The included S3Mock is suitable only for a demo/staging deployment. Replace it with private S3-compatible storage and real credentials for production. Stripe payment completion also requires test-mode Stripe keys and a webhook endpoint at `https://aureva.example.com/api/v1/webhooks/stripe`.

## 4. Configure HTTPS Routing

```bash
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo sed -i 's/example.com/your-real-domain.com/g' /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy terminates HTTPS, forwards API traffic, and upgrades Orvyn WebSocket connections. All Compose-published ports bind to `127.0.0.1`, so only Caddy exposes application traffic publicly.

## 5. Verify

```bash
curl -I https://orvyn.your-real-domain.com
curl -I https://aureva.your-real-domain.com
curl -fsS https://aureva.your-real-domain.com/api/v1/products?limit=1
```

Then test registration/login, an Orvyn collaborative page in two browser windows, AUREVA customer/vendor/admin journeys, uploads, and browser console/network errors.

## 6. Update and Roll Back

```bash
git pull --ff-only
(cd FS-01 && docker compose up -d --build)
(cd FS-02 && docker compose up -d --build)
```

Back up both PostgreSQL volumes before migrations. Keep the previous Git commit and container images available for rollback. Never commit `.env` files, provider keys, database dumps, or TLS private keys.
