# Orvyn Submission Deliverables

This index maps every evaluation criterion to its evidence in the repository. The working demo was recorded from the complete local Docker stack, not a static mockup.

| Evaluation criterion | Evidence |
| --- | --- |
| Working demo | [Watch/download the Orvyn working demo](demos/orvyn-working-demo.webm), [landing screenshot](screenshots/landing.png), and [authentication screenshot](screenshots/authentication.png) |
| Complete code and setup | [Project README](../README.md), [environment template](../.env.example), [Docker Compose stack](../compose.yaml), and [deployment guide](deployment.md) |
| Architecture and data/API documentation | [System architecture](architecture.md), [data model](data-model.md), [REST API reference](api-reference.md), and [WebSocket protocol](websocket-protocol.md) |
| Test and performance results | [Testing guide](testing.md) and [measured test/load report](test-report-2026-11-17.md) |
| Ten-minute presentation | [Presentation outline](presentation-outline.md) |
| Individual reflection | [Srajan's completed reflection](individual-reflection.md) |

## Demo Flow

The recording demonstrates the landing page, registration, authenticated dashboard, workspace creation, page creation, and editing inside the Yjs-backed collaborative editor.

## Run Locally

```bash
cp .env.example .env
npm ci
npm run db:generate
docker compose up -d --build
npm run db:seed
```

Open `http://localhost:5173`. See the [README](../README.md) for service URLs, test commands, and production configuration.
