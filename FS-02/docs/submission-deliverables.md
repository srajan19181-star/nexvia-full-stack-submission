# AUREVA Submission Deliverables

This index maps every evaluation criterion to its evidence in the repository. The working demo was recorded from the complete local Docker stack, not a static mockup.

| Evaluation criterion | Evidence |
| --- | --- |
| Working demo | [Watch/download the AUREVA working demo](demos/aureva-working-demo.webm), [storefront screenshot](screenshots/storefront.png), and [catalog screenshot](screenshots/catalog.png) |
| Complete code and setup | [Project README](../README.md), [environment template](../.env.example), [Docker Compose stack](../compose.yaml), and [deployment guide](deployment.md) |
| Architecture and data/API documentation | [System architecture](architecture.md), [ER diagram](er-diagram.md), and [REST API reference](api.md) |
| Test and performance results | [Testing guide](testing.md), [test report](test-report.md), and [measured performance report](performance.md) |
| Ten-minute presentation | [Presentation outline](presentation.md) |
| Individual reflection | [Srajan's completed reflection](individual-reflection.md) |

## Demo Flow

The recording demonstrates the public storefront and catalog, customer authentication and cart flow, vendor product and analytics screens, and administrator overview and customer management.

## Run Locally

```bash
cp .env.example .env
npm ci
npm run db:generate
docker compose up -d --build
npm run db:seed
```

Open `http://localhost:5174`. See the [README](../README.md) for demo accounts, service URLs, test commands, and provider configuration.
