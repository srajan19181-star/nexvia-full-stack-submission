# Security Model

## Identity and Sessions

- Passwords use Argon2id; opaque expiring sessions are stored server-side and delivered only in secure HttpOnly cookies.
- State-changing REST requests require an HMAC-authenticated double-submit CSRF proof.
- Registration, login, password reset, and other sensitive routes are rate limited and validated with Zod.

## Authorization

- Effective workspace and page permissions are calculated on the server for every protected REST operation.
- The collaboration handshake validates the session, origin, workspace membership, page access, and requested room.
- Viewers may synchronize document state but incoming Yjs mutation frames are rejected before durable persistence.
- Membership changes, comments, invitations, and history restoration use explicit role and capability checks.

## Transport and Data Safety

- Helmet security headers, CSP, CORS allowlists, WebSocket origin checks, bounded bodies/messages, and centralized sanitized errors reduce common web risks.
- PostgreSQL is the durable source of truth for metadata and Yjs binary state; Redis is not treated as durable storage.
- Secrets are supplied through environment variables and excluded from frontend bundles and source control.
- Production deployment requires TLS, rotated secrets, restricted service networks, managed backups, and monitored audit logs.

See the [architecture](architecture.md), [API reference](api-reference.md), and [WebSocket protocol](websocket-protocol.md) for enforcement details.
