# API reference

All application routes are under `/api/v1`. Successful responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "code", "message", "details?" } }`.

## Authentication

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create customer account and session |
| POST | `/auth/login` | Public/rate-limited | Start rotated cookie session |
| POST | `/auth/refresh` | Refresh cookie | Rotate token family |
| POST | `/auth/logout` | Session | Revoke session |
| GET | `/auth/me` | Authenticated | Current principal |
| POST | `/auth/forgot-password` | Public | Generic reset request |
| POST | `/auth/reset-password` | Reset token | Replace password and revoke sessions |

Mutating authenticated requests send `X-CSRF-Token` matching the readable `aureva_csrf` cookie. Access and refresh JWTs are HttpOnly.

## Catalog and discovery

- `GET /products` — `q`, `category`, `vendor`, `minPrice`, `maxPrice`, `rating`, `inStock`, `sort`, `page`, `limit`.
- `GET /products/:slug`, `GET /categories`, `GET /vendors`, `GET /vendors/:slug`.
- `GET /search?q=` — Elasticsearch result with PostgreSQL fallback.

## Customer commerce

- `GET /cart`, `PUT /cart/items`, `DELETE /cart/items/:variantId`.
- `GET|POST /addresses`, `DELETE /addresses/:id`.
- `GET /wishlist`, `POST|DELETE /wishlist/:productId`.
- `POST /checkout` requires a unique `Idempotency-Key` header.
- `GET /orders`, `GET /orders/:id`, `GET /orders/:id/invoice`.
- `POST /reviews`, `GET /notifications`, `POST /support`.

## Vendor

- `POST /vendors/apply` — create pending application.
- `GET /vendors/dashboard`, `GET|POST /vendors/products`, `PUT /vendors/products/:id`.
- `GET /vendors/orders`, `POST /vendors/orders/:id/status`.
- `POST /vendors/uploads/presign` validates MIME type and 8 MB maximum.

## Admin

- `GET /admin/overview`, `/admin/vendors`, `/admin/products`, `/admin/orders`, `/admin/audit`.
- `POST /admin/vendors/:id/decision` and `/admin/products/:id/moderate`.

## Payments

`POST /webhooks/stripe` receives the raw request body, verifies the Stripe signature, stores a unique provider event, and transitions payment/order/inventory in one database transaction. Duplicate provider event IDs are ignored.

HTTP status conventions: `200` read/update, `201` creation, `202` external configuration/action pending, `400` malformed workflow, `401` unauthenticated, `403` unauthorized/CSRF, `404` missing, `409` state or inventory conflict, `422` validation.
