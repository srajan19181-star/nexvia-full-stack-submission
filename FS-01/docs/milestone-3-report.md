# Milestone 3 report

## Completed

- TipTap 3 editor schema backed by a Yjs document fragment rather than HTML or JSON autosave.
- Headings, paragraphs, bold, italic, underline, strike, links, bullet and numbered lists, checklists, blockquotes, inline code, code blocks, resizable tables, collaborative undo/redo, and keyboard shortcuts.
- Responsive formatting toolbar, accessible labels, slash-command palette, placeholder behavior, read-only mode, table styling, task-list styling, and remote-caret rendering hooks.
- PostgreSQL Yjs repository that lazily initializes binary document state, replays append-only updates in database order, and returns the active generation and durable cursor.
- SHA-256 update deduplication through the compound database constraint, actor/instance attribution, transactional version increments, and generation-change rejection.
- Safe binary compaction that writes a full state update and state vector before pruning only updates covered by the durable compaction cursor.

## Verification executed

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Passed for all applications and packages |
| `npm test` | 23 passed: 12 API, 2 collaboration persistence, 4 React/editor, 5 shared |
| `npm run build` | Passed for all packages and applications |
| Restart persistence | A second repository instance reconstructed the exact Yjs content from PostgreSQL |
| Duplicate replay | Re-appending the same binary update returned the original update ID without a second row |
| Compaction | Full state survived update-log pruning and a fresh load |
| Dependency audit | Install completed with 0 vulnerabilities |

## Source-of-truth guarantee

Collaborative page content is represented only by Yjs binary state and updates in PostgreSQL. The editor does not post HTML or JSON as authoritative content. Page title and other metadata remain ordinary REST resources.

## Remaining issues

The editor component is intentionally not mounted on the product route until the authenticated collaboration transport is active. This prevents users from typing into a temporary local document that appears saved. Network synchronization, reconnect behavior, and WebSocket write enforcement are Milestone 4.

## Exact next steps

1. Authenticate WebSocket upgrades from the existing HttpOnly session cookie.
2. Authorize every page room and classify each connection as editable or read-only.
3. Implement the y-websocket sync and awareness framing with size/origin checks.
4. Persist incoming document updates before applying and broadcasting them.
5. Add convergence, reconnect, restart, and viewer-write-denial integration tests.
