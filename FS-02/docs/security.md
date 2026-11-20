# Security considerations

- Argon2id hashes passwords. Access JWTs expire quickly; refresh tokens rotate, are hashed in PostgreSQL, and revoke their family on reuse.
- Auth tokens are Secure/HttpOnly in production and never enter localStorage. Mutations require double-submit CSRF validation.
- Helmet headers, CORS allowlist, JSON size limits, auth rate limits, Zod validation, Prisma parameterization, and redacted Pino logs are enabled.
- Vendor operations resolve the vendor from the authenticated owner and constrain every product/order query by vendor ID. Admin checks execute server-side.
- Checkout ignores browser totals, recalculates from product variants, uses serializable transactions, conditional reservations, idempotency keys, and valid status transitions.
- Stripe events require raw-body signature verification and unique provider event IDs. S3 keys are randomized; MIME type and size are allowlisted.
- Production work still requires secret rotation, managed TLS, CSP tailored to asset domains, email verification delivery, malware scanning for uploads, dependency scanning, backups, restore drills, and jurisdiction-specific privacy/tax review.
