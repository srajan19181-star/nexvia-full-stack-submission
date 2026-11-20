# WebSocket protocol and authorization

## Connection

Connect to `wss://<host>/collaboration/:pageId?generation=<positive integer>`. The browser automatically sends the HttpOnly session cookie. The gateway rejects missing/untrusted origins, invalid sessions, inaccessible pages, deleted pages, and stale document generations during upgrade.

Close codes used by the service include authentication/authorization failures, invalid binary protocol data, document generation reset, and retryable server restart. Clients reconnect with bounded backoff and repeat Yjs state-vector synchronization.

## Frames

Frames are binary and compatible with `y-websocket`:

- `sync`: Yjs sync step 1, sync step 2, and update frames.
- `awareness`: ephemeral selection/presence updates.
- `queryAwareness`: request the current room awareness snapshot.

The server decodes updates before persistence. Before every mutation it refreshes the principal’s effective permissions. Sync step 1 remains available to readers; viewer/commenter update frames close the connection and are never appended.

## Presence

Each connection may own one awareness client ID. The server replaces client-provided identity with the authenticated user ID, display name, avatar, deterministic cursor color, and effective permission. Awareness is removed on disconnect and stale cross-instance presence expires after missed heartbeats. Cursor locations are never written to PostgreSQL.

## Multi-instance synchronization

1. Instance A receives an authorized update.
2. It appends the binary update to PostgreSQL with a unique `(pageId, generation, updateHash)` constraint.
3. It replays every durable row after its contiguous watermark, including any concurrent earlier row.
4. It publishes a Redis invalidation containing the durable update ID.
5. Instance B receives the invalidation and replays ordered rows from PostgreSQL.
6. Periodic reconciliation performs the same replay even if Redis messages were lost.

Redis does not provide durable state, replay, or authoritative ordering. PostgreSQL and Yjs idempotency provide those properties.

## Restore

REST authorizes a restore and sends an HMAC-signed internal request to collaboration. The service snapshots the active state, creates a new generation from the selected snapshot, records audit metadata, and publishes a Redis reset. All old-generation sockets close and reconnect to the new generation.
