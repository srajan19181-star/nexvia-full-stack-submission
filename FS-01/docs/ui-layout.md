# Initial UI layout

## Desktop application shell

```text
┌────────────── 280 px ──────────────┬──────────────────────────────────────────┬──── 360 px ────┐
│ Workspace switcher                 │ Breadcrumbs        Search   Avatars Share │ Comments        │
│ Quick search                       ├──────────────────────────────────────────┤ / history       │
│ Page tree                          │                                          │                 │
│   Nested pages                     │          760–880 px editor column         │ Contextual and  │
│ Favorites                          │                                          │ collapsible     │
│ Settings / user menu               │                                          │                 │
└────────────────────────────────────┴──────────────────────────────────────────┴─────────────────┘
```

The left rail collapses to icons. The right panel is optional and never shrinks the editor below its readable minimum; at narrower widths it becomes an overlay. Toolbar controls use accessible labels, visible focus rings, and keyboard shortcuts.

## Mobile shell

The sidebar becomes a left drawer, comments/history become a full-height sheet, breadcrumbs collapse to the current page title, and the editor toolbar exposes common controls plus a keyboard-accessible overflow menu. Touch targets are at least 44 pixels.

## Visual direction

The interface uses warm neutral surfaces, an indigo-violet collaboration accent, restrained borders, and soft elevation. Light and dark themes share semantic color tokens. Motion communicates drawer, menu, and save-state changes and is disabled for `prefers-reduced-motion`.
