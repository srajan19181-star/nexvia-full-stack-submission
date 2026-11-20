# REST API reference

Base path: `/api/v1`. JSON responses use `{ "data": ... }`; errors use `{ "error": { "code", "message", "details?" } }`. Mutating requests require the `x-csrf-token` value returned by `GET /auth/csrf` and the matching CSRF cookie. Authentication uses the HttpOnly session cookie.

## Authentication and users

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/auth/csrf` | none | CSRF token and readable CSRF cookie |
| POST | `/auth/register` | `{ name, email, password }` | `201`, user and session cookie |
| POST | `/auth/login` | `{ email, password }` | user and session cookie |
| GET | `/auth/me` | none | current public user |
| PATCH | `/auth/me` | any of `{ name, avatarUrl, theme }` | updated public user |
| POST | `/auth/logout` | none | `204`, revoked session |
| POST | `/auth/forgot-password` | `{ email }` | generic `202` response |
| POST | `/auth/reset-password` | `{ token, password }` | `204`, all sessions revoked |

Passwords require 12–128 characters with upper/lowercase, number, and symbol. Profile names are 2–80 characters; avatar URLs are nullable HTTPS/HTTP URLs up to 2048 characters.

## Dashboard and search

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Accessible workspaces, recent pages, and recent activity |
| GET | `/search?q=...` | Search accessible workspace names, page titles, and indexed content |

## Workspaces, members, and invitations

| Method | Path | Authorization |
| --- | --- | --- |
| GET/POST | `/workspaces` | authenticated; create makes caller owner |
| GET/PATCH/DELETE | `/workspaces/:workspaceId` | member / admin / owner |
| GET | `/workspaces/:workspaceId/members` | member |
| PATCH/DELETE | `/workspaces/:workspaceId/members/:memberId` | administrator |
| GET/POST | `/workspaces/:workspaceId/invitations` | administrator |
| DELETE | `/workspaces/:workspaceId/invitations/:invitationId` | administrator |
| POST | `/workspaces/invitations/accept` | authenticated token recipient |
| POST | `/workspaces/invitations/reject` | authenticated token recipient |

Invitations contain opaque, expiring tokens; only token hashes are stored. Roles are `OWNER`, `ADMIN`, `MEMBER`; content roles are `EDITOR`, `COMMENTER`, `VIEWER`.

## Pages and permissions

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/workspaces/:workspaceId/pages` | list or create pages |
| POST | `/workspaces/:workspaceId/pages/reorder` | reorder/reparent pages |
| GET/PATCH/DELETE | `/workspaces/:workspaceId/pages/:pageId` | read, update, or soft-delete |
| POST | `/workspaces/:workspaceId/pages/:pageId/restore` | restore soft-deleted subtree |
| POST/DELETE | `/workspaces/:workspaceId/pages/:pageId/favorite` | set/remove favorite |
| GET | `/workspaces/:workspaceId/pages/:pageId/permissions` | effective access list |
| PATCH/DELETE | `/workspaces/:workspaceId/pages/:pageId/permissions/:memberId` | set/remove admin override |

Page IDs are stable CUIDs. Collaborative content is not accepted through these endpoints; Yjs binary state is authoritative through the collaboration service.

## Comments, history, and activity

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/workspaces/:workspaceId/pages/:pageId/comments` | list/create anchored comments |
| POST | `/workspaces/:workspaceId/pages/:pageId/comments/:commentId/replies` | reply |
| PATCH | `/workspaces/:workspaceId/pages/:pageId/comments/:commentId/status` | resolve/reopen |
| DELETE | `/workspaces/:workspaceId/pages/:pageId/comments/:commentId` | authorized delete |
| DELETE | `/workspaces/:workspaceId/pages/:pageId/comments/:commentId/replies/:replyId` | authorized reply delete |
| GET/POST | `/workspaces/:workspaceId/pages/:pageId/history` | list/create milestone snapshot |
| GET | `/workspaces/:workspaceId/pages/:pageId/history/:snapshotId` | preview immutable snapshot |
| POST | `/workspaces/:workspaceId/pages/:pageId/history/:snapshotId/restore` | authorized safe restore |
| GET | `/workspaces/:workspaceId/activity?limit=&cursor=` | cursor-paginated audit activity |

List endpoints validate bounded pagination. Validation failures return `422`; missing authentication `401`; insufficient authorization `403`; missing resources `404`; conflicts `409`; rate limiting `429`.
