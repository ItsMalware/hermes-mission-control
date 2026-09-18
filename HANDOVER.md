# Hermes Desktop — Agent Handover

## Project Overview

Hermes Desktop is a fork of the Nous `hermes-agent` Electron app. The goal is to keep all of Nous's features (chat, voice, settings, artifacts, profiles, etc.) while applying the Hermes UI aesthetic: visible wallpaper behind translucent surfaces, a minimal sidebar with cat logo and labeled nav, and card-style session rows.

The `hermes-mission-control` plugin (`apps/desktop/src/plugins/hermes-mission-control/`) provides:
- Custom CSS overrides for wallpaper + translucent surfaces
- Custom pages: Mission Control, Self, SEO, Agents (AI CLIs)
- Sidebar nav configuration
- Session card styling

## What's Done

- **Wallpaper visibility**: Fixed. CSS variable overrides in `mission-control.css` make all surfaces translucent (74% opacity via `color-mix`). The wallpaper div is mounted by the plugin at `document.body.prepend()` with 0.32 opacity.
- **Sidebar nav**: Replaced Nous's icon-only sidebar with labeled nav items (Mission Control, Chat, AI CLIs, Self, Workspace, Settings) plus Hermes cat logo. Note: SEO is deliberately NOT in the sidebar — OpenSEO lives as a tab inside the Self page (`self.tsx`, `SEOEmbed` extracted from `seo.tsx`). The standalone `/seo` route + palette command still exist.
- **Session card styling**: CSS classes (`hermes-card-content`, `hermes-tag`, etc.) style session rows as cards with metadata tags.
- **Surface readability**: Balanced transparency (74% surface — 76% for sidebar, 0.32 wallpaper) so content is readable while wallpaper shows through.
- **AI CLIs tab**: Fixed. Was a route collision — the plugin registered `AgentsPage` at `/profiles`, which is a reserved built-in path, so `contributedRoutes()` silently dropped it and clicks opened the built-in `ProfilesView` overlay instead. Moved the plugin route and palette command to `/ai-clis` (`plugin.tsx`), and the sidebar nav item with it (`sidebar/index.tsx`). The built-in `/profiles` overlay is untouched and still works.
- **Sessions on Chat tab only**: Done (approach 1). `sidebar/index.tsx` now gates the search field, session sections, and blank state behind `onChatTab` (`currentView === 'chat'`). Other tabs show nav-only sidebar. If the user still wants sessions physically inside the chat pane, that's the "full restructure" below.
- **OpenSEO auto-start**: `electron/openseo-docker.ts` (wired into `main.ts` after `createWindow()`) ensures the `open-seo-open-seo-1` container is running at boot — launches Docker Desktop on macOS if the daemon is down (bounded 60s poll), heals via the compose project (`HERMES_DESKTOP_OPENSEO_COMPOSE` env override, else the container's own compose labels, else the default `~/open-seo/compose.yaml`), falls back to `docker start`/`docker run`, then verifies TCP 127.0.0.1:3001. Best-effort: failures log and the tab's Retry is the recovery path. Tests: `openseo-docker.test.ts`.
- **Self page blocks fixed**: The SDK `TabsList` has a fixed `h-9` track — when used as a card grid (`.self-tool-tabs`), extra rows painted over the blocks below. Override with `height: auto`. Also: Radix triggers signal active via `data-state="active"`, NOT an `.active` class; and `--ui-bg-secondary` is only ~7% opaque — cards on translucent pages need `color-mix(in srgb, var(--ui-bg-chrome) 88%, transparent)` to read as solid over the wallpaper.

## Remaining Tasks

### Task 12 (follow-up, optional): Move Session List Into the Chat Pane

Approach 1 (conditional sidebar rendering) is done. Only do this if the user still wants sessions physically inside the chat area rather than the sidebar.

**Full restructure**:
- Extract the session list UI from `ChatSidebar` into a standalone component
- Add it to `ChatView` (`apps/desktop/src/app/chat/index.tsx`) as a collapsible left panel
- The sidebar would become nav-only on all tabs
- This is more invasive — requires threading all the session action callbacks through `ChatView`

**Architecture notes**:
- `SidebarSurface` (in `apps/desktop/src/app/contrib/surfaces.tsx:45`) wraps `ChatSidebar` and passes a `currentView` prop
- The sidebar is rendered by the layout tree system; the workspace pane is separate
- Session sections currently live at `sidebar/index.tsx` lines ~1243-1488 (search field, pinned, sessions/projects)

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/desktop/src/plugins/hermes-mission-control/plugin.tsx` | Plugin entry: registers routes, palette commands, mounts wallpaper |
| `apps/desktop/src/plugins/hermes-mission-control/mission-control.css` | All Hermes CSS: wallpaper, surface transparency, session cards, page styles |
| `apps/desktop/src/app/chat/sidebar/index.tsx` | Sidebar component: nav items, session lists, search |
| `apps/desktop/src/app/contrib/controller.tsx` | App shell: SidebarProvider, titlebar, layout root |
| `apps/desktop/src/app/contrib/surfaces.tsx` | Surface wiring: SidebarSurface, ChatRoutesSurface (route table) |
| `apps/desktop/src/app/contrib/wiring.tsx` | Overlay routing: profiles/settings/agents overlays |
| `apps/desktop/src/app/routes.ts` | Route definitions, RESERVED_PATHS, OVERLAY_VIEWS, contributedRoutes() |
| `apps/desktop/src/app/chat/index.tsx` | Chat view component |
| `apps/desktop/src/styles.css` | Core theme variables (--ui-bg-chrome, --color-background, etc.) |
| `apps/desktop/electron/openseo-docker.ts` | Boot-time ensure for the OpenSEO Docker container |

## CSS Layer Stack

Bottom to top:
1. `<html>` — opaque base bg (inline style set by JS: `rgb(246, 250, 248)`)
2. `<body>` — **transparent** (overridden by plugin CSS)
3. Wallpaper div (`#hmc-global-wallpaper`) — fixed, z-index 0, opacity 0.32
4. `SidebarProvider` (controller.tsx:716) — `bg-background` → `--color-background` → **transparent** (overridden by plugin CSS)
5. Controller div (controller.tsx:723) — `bg-(--ui-chat-surface-background)` → 74% opaque
6. Content areas — no additional backgrounds (duplicates were removed from chat/index.tsx:479)

## Dev Commands

```bash
# Type check (from repo root; plain `npx tsc` from root grabs the wrong package)
apps/desktop/node_modules/.bin/tsc --noEmit -p apps/desktop/tsconfig.json

# Dev server (renderer only, no Electron)
npm run -w apps/desktop dev:renderer

# Full Electron dev (fake boot — no real backend)
npm run -w apps/desktop dev:fake-boot

# Full Electron dev (real backend — renderer + Electron via concurrently)
npm run -w apps/desktop dev
```

## CLI Tools Available

- **opencode** (`/usr/local/bin/opencode`, v1.17.7) — AI coding assistant CLI, can be used to delegate changes
- **agy** (v1.1.7) — AI agent CLI, can be used for verification tasks

## User Preferences

- Prefers minimal, clean UI — no clutter
- Wants visible wallpaper behind all surfaces
- Hermes cat logo in sidebar
- Card-style session rows with metadata tags (source, model, message count)
- Terse communication — doesn't want long explanations of what was done
- Gets frustrated with slow progress on CSS issues — be systematic, trace the full layer stack before making changes
