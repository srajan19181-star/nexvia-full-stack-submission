# Milestone 4 report

## Completed

- Dedicated y-websocket-compatible collaboration gateway at `/collaboration/:pageId` with no REST content mutation fallback.
- Existing HttpOnly session-cookie authentication, exact WebSocket origin allowlisting, active page/membership lookup, and permanent 44xx close signaling.
- Effective owner, admin, editor, commenter, viewer, and page-override permission calculation at room join.
- Permission and session refresh before every incoming document mutation, including immediate denial after a live member downgrade.
- Binary frame and payload-size enforcement, serialized room operations, malformed update rejection, and no per-message compression.
- Persistence-before-apply ordering: an update is committed and deduplicated in PostgreSQL before it reaches the active Y.Doc or another client.
- Bidirectional Yjs handshake support for initial state, offline local updates, reconnect, and full state recovery after service restart.
- Heartbeats, dead-socket termination, idle room compaction/disposal, readiness checks, permanent authorization errors, and graceful drain/shutdown.
- React provider lifecycle with connection, reconnect, offline queue, saved, and permission-change states.

## Verification executed

| Gate | Result |
| --- | --- |
| Concurrent edits | Two real `y-websocket` clients edited simultaneously and converged to the same CRDT state |
| Reconnect | Offline and online edits merged after reconnect without overwrite or loss |
| Restart persistence | A fresh server and client reconstructed the durable PostgreSQL document |
| Initial viewer denial | A viewer update closed with 4403 and created no update row |
| Live downgrade denial | An open editor socket was downgraded; its next update closed with 4403 and was not persisted |
| Origin/session denial | Missing cookie closed with 4401; untrusted origin closed with 4403 |
| Built binary smoke | Bundled service `/health/ready` reported WebSocket sync and durable Yjs persistence active |

## Security behavior

The server never trusts the browser's requested role. Room access comes from PostgreSQL membership and page overrides. A read-only client may complete Yjs synchronization but its sync-step payload is ignored and every normal update frame is denied. Mutation authorization is refreshed on each frame, so a connection does not retain stale write access.

## Remaining issues

No known single-instance synchronization issue remains. Redis cross-instance fan-out and gap recovery are deliberately not represented as active in readiness until Milestone 7 tests prove them.

## Exact next steps

1. Expose awareness state through authenticated, ephemeral presence.
2. Sanitize user identity while preserving cursor relative positions.
3. Render online avatars, selections, and reconnect status.
4. Verify clean and unclean stale-presence removal.
