# IPC Handler Mapping: Legacy Desktop vs Nous hermes-agent Desktop

Audit of ~80 unique old IPC handlers vs Nous app's ~120 IPC handlers.
Nous app uses `hermes:*` namespaced channels; old app uses flat names.

## Status Legend

- **drop** -- Nous has a superior/complete implementation; delete our code
- **keep** -- Nous already covers this; no work needed
- **port** -- Unique to us; must be ported into the Nous plugin system

---

## Installation & Bootstrap

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `check-install` | `hermes:boot-progress:get`, `hermes:bootstrap:get` | drop |
| `verify-install` | `hermes:bootstrap:repair` | drop |
| `start-install` | `hermes:bootstrap:reset`, `hermes:bootstrap:continue-local` | drop |
| `get-hermes-version` | `hermes:version` | drop |
| `refresh-hermes-version` | `hermes:version` | drop |
| `run-hermes-doctor` | -- (no equivalent) | port |
| `run-hermes-update` | `hermes:updates:check` + `hermes:updates:apply` | drop |
| `check-openclaw` | -- (OpenClaw migration, legacy only) | drop |
| `run-claw-migrate` | -- (OpenClaw migration, legacy only) | drop |

## Configuration

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `get-locale` / `set-locale` | -- (Nous uses browser locale / nanostores) | port |
| `get-env` / `set-env` | -- (Nous manages env via connection config + backend env) | port |
| `get-config` / `set-config` | `hermes:setting:*` handlers | drop |
| `get-hermes-home` | Built into `backend-env.ts` (`normalizeHermesHomeRoot`) | drop |
| `get-model-config` / `set-model-config` | Gateway RPC model selection (nanostore-driven) | drop |
| `get-credential-pool` / `set-credential-pool` | -- (unique to us) | port |

## Connection & Gateway

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `is-remote-mode` | `hermes:connection` (returns full connection state) | drop |
| `get-connection-config` / `set-connection-config` | `hermes:connection-config:get/save/apply` | drop |
| `test-remote-connection` | `hermes:connection-config:test` | drop |
| `start-gateway` / `stop-gateway` / `gateway-status` | `hermes:connection` + `hermes:backend:touch` (auto-managed) | drop |

## Chat & Messaging

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `send-message` | `hermes:api` (generic gateway RPC) + WebSocket streaming | drop |
| `abort-chat` | Gateway RPC abort via WebSocket | drop |
| `chat-chunk` (event) | WebSocket streaming in renderer | drop |
| `chat-done` / `chat-error` (events) | WebSocket lifecycle events | drop |
| `chat-tool-progress` / `chat-usage` (events) | WebSocket streaming payloads | drop |

## Sessions

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `list-sessions` | Gateway RPC `session.list` via WebSocket | drop |
| `get-session-messages` | Gateway RPC `session.get` via WebSocket | drop |
| `list-cached-sessions` | -- (Nous caches in renderer via nanostores) | drop |
| `sync-session-cache` | -- (automatic in Nous renderer) | drop |
| `update-session-title` | Gateway RPC `session.updateTitle` | drop |
| `search-sessions` | Gateway RPC `session.search` | drop |

## Profiles

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `list-profiles` | `hermes:profile:get` (single active profile) | port |
| `create-profile` | -- (no multi-profile UI in Nous) | port |
| `delete-profile` | -- (no multi-profile UI in Nous) | port |
| `set-active-profile` | `hermes:profile:set` | keep |

## Memory & Soul

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `read-memory` | -- (Nous uses gateway RPC for memory) | port |
| `add-memory-entry` / `update-memory-entry` / `remove-memory-entry` | -- (gateway RPC) | port |
| `write-user-profile` | -- (gateway RPC) | port |
| `read-soul` / `write-soul` / `reset-soul` | -- (unique persona system) | port |

## Tools & Skills

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `get-toolsets` / `set-toolset-enabled` | -- (Nous manages tools via gateway config) | port |
| `list-installed-skills` / `list-bundled-skills` | -- (no skill marketplace in Nous) | port |
| `get-skill-content` / `install-skill` / `uninstall-skill` | -- (no skill marketplace in Nous) | port |

## Models

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `list-models` | Gateway RPC model list | drop |
| `add-model` / `remove-model` / `update-model` | -- (Nous uses gateway model registry) | port |

## Claw3D (3D Avatar)

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `claw3d-status` / `claw3d-setup` | `hermes:pet-overlay:*` (pet overlay system) | drop |
| `claw3d-get-port` / `claw3d-set-port` | -- (pet overlay manages its own state) | drop |
| `claw3d-get-ws-url` / `claw3d-set-ws-url` | -- | drop |
| `claw3d-start-all` / `claw3d-stop-all` | `hermes:pet-overlay:open/close` | drop |
| `claw3d-get-logs` | -- | drop |
| `claw3d-start-dev` / `claw3d-stop-dev` | -- | drop |
| `claw3d-start-adapter` / `claw3d-stop-adapter` | -- | drop |

## Cron Jobs

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `list-cron-jobs` | -- (no cron UI in Nous desktop) | port |
| `create-cron-job` / `remove-cron-job` | -- | port |
| `pause-cron-job` / `resume-cron-job` / `trigger-cron-job` | -- | port |

## Platform Toggles

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `get-platform-enabled` / `set-platform-enabled` | -- (unique to us) | port |

## Utilities

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `open-external` | `hermes:openExternal` | keep |
| `run-hermes-backup` / `run-hermes-import` | -- (unique to us) | port |
| `run-hermes-dump` | `hermes:logs:reveal` + `hermes:logs:recent` | drop |
| `list-mcp-servers` | -- (Nous manages MCP via gateway) | port |
| `discover-memory-providers` | -- (unique to us) | port |
| `read-logs` | `hermes:logs:recent` | drop |

## Updates

| Old IPC Handler | Nous Equivalent | Status |
|---|---|---|
| `get-app-version` | `hermes:version` | drop |
| `check-for-updates` | `hermes:updates:check` | drop |
| `download-update` / `install-update` | `hermes:updates:apply` | drop |

## Nous-Only (new capabilities we get for free)

| Nous IPC Handler | What it does |
|---|---|
| `hermes:pet-overlay:*` | Desktop pet overlay with compositor integration |
| `hermes:quick-entry:*` | Global hotkey mini-composer window |
| `hermes:cloud:*` | Hermes Cloud login, discovery, agent sign-in |
| `hermes:git:*` | Full git worktree, review, PR creation workflow |
| `hermes:terminal:*` | Integrated terminal with node-pty |
| `hermes:fs:*` | File system operations (readDir, rename, trash, writeText) |
| `hermes:vscode-theme:*` | VS Code theme marketplace search/fetch |
| `hermes:uninstall:*` | Clean uninstall with summary |
| `hermes:find-in-page` | Browser-style find-in-page |
| `hermes:wake-indicator:*` | Idle/active wake state indicator |
| `hermes:zoom:*` | Window zoom controls |

---

## Summary

| Status | Count | Notes |
|---|---|---|
| **drop** | ~42 | Nous has superior implementation or feature is obsolete |
| **keep** | ~3 | Already mapped 1:1 |
| **port** | ~30 | Unique features needing migration to Nous plugin system |

### Priority port targets (unique value)

1. **Soul system** (read/write/reset-soul) -- persona customization, no Nous equivalent
2. **Cron jobs** (6 handlers) -- scheduled agent tasks, unique to us
3. **Skills marketplace** (5 handlers) -- skill install/uninstall/browse
4. **Multi-profile management** (3 handlers) -- create/delete/list profiles
5. **Memory editor** (5 handlers) -- direct memory CRUD with UI
6. **Platform toggles** (2 handlers) -- enable/disable platform integrations
7. **Credential pool** (2 handlers) -- multi-key rotation
8. **Backup/import** (2 handlers) -- data portability
9. **Locale** (2 handlers) -- i18n preference persistence
10. **MCP server listing** (1 handler) -- MCP discovery UI
