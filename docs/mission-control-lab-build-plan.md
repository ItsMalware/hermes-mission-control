# Hermes Mission Control Lab Build Plan

Last updated: 2026-05-25

## Purpose

Build a Hermes-native Mission Control experience inside Hermes Desktop so the app can show the user's local agent OS clearly: agent teams, directors, sessions, models, provider health, secrets inventory, Kanban, Project Room artifacts, and Notion-facing status.

This work starts from the current Hermes Desktop fork and should remain shareable upstream where possible. The lab app copy exists so experiments do not replace the main installed app until they are verified.

## Current Safe Copy

- Source repo: `<local-hermes-desktop-repo>`
- Active branch: `codex/mission-control-lab`
- Main installed app: `/Applications/Hermes Agent.app`
- Lab app copy: `/Applications/Hermes Mission Control Lab.app`
- Lab bundle display name: `Hermes Mission Control Lab`
- Lab bundle identifier: `com.nousresearch.hermes.mission-control-lab`
- Hermes runtime boundary: `<user-home>/.hermes/hermes-agent`
- Hermes config boundary: `<user-home>/.hermes/config.yaml`
- Profile boundary: `<user-home>/.hermes/profiles/*`
- Project Room pointer: `<user-home>/.hermes/project-room`

## Product Direction

Add a default Mission Control area to Hermes Desktop. The first screen should answer:

- Is Hermes healthy?
- Which agents/directors exist?
- Which teams do they belong to?
- Which sessions are active or stale?
- Which model/provider route is active?
- What secrets exist, without exposing secret values by default?
- What Kanban work is pending, running, or completed?
- What Project Room artifacts need review?
- What should be synced or summarized into Notion?

## Non-Negotiables

- Do not delete, rename, or overwrite user Hermes configs.
- Do not display raw secret values by default.
- Do not merge GPT fallback back into automatic routing unless explicitly requested.
- Keep the source checkout, installed app, lab app, and Hermes runtime as separate systems.
- Preserve current Kanban, multi-tab chat, session sync, provider/model routing, and background/theme work.
- Prefer read-only inventory endpoints first, then add write actions after UI safety is clear.
- Keep changes scoped and upstreamable where possible.

## Workstream 1: Shell and Navigation

Objective: Add a Mission Control home without disrupting existing tabs.

Suggested owner: frontend agent

Likely files:

- `src/renderer/src/screens`
- `src/renderer/src/components`
- `src/shared/i18n/locales/en/navigation.ts`
- `src/shared/i18n/locales/en/common.ts`

Tasks:

- Add `Mission Control` as a first-class navigation item.
- Create a dashboard layout with status cards and compact system panels.
- Reuse the deep jade retro jewel theme and current cozy background.
- Keep Chat, Sessions, Kanban, Models, Providers, Settings accessible.
- Avoid nested card-heavy UI; use dense operational panels.

Success criteria:

- App opens to Mission Control or can switch to it reliably.
- Existing tabs still render.
- No text overlaps at laptop and desktop widths.

## Workstream 2: Health and Status API

Objective: Give Mission Control reliable read-only state about the local agent OS.

Suggested owner: backend/Electron agent

Likely files:

- `src/main/hermes.ts`
- `src/main/providers.ts`
- `src/main/models.ts`
- `src/main/sessions.ts`
- `src/main/kanban.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

Tasks:

- Add one aggregated health endpoint, for example `missionControl.getStatus()`.
- Report status for Hermes runtime, session cache, models, providers, Kanban, profiles, Project Room, and update status.
- Normalize states to `LIVE`, `BUSY`, `DEGRADED`, `OFFLINE`, and `UNKNOWN`.
- Include timestamps and error summaries, not giant logs.

Success criteria:

- Mission Control can load one status payload quickly.
- A failing subsystem does not hang the whole dashboard.
- Tests cover timeout/failure behavior.

## Workstream 3: Agent Teams Inventory

Objective: Show directors and teams as the user thinks about them.

Suggested owner: profiles/config agent

Likely files:

- `src/main/profiles.ts`
- `src/main/config.ts`
- `src/renderer/src/screens`
- `src/shared/i18n/locales/en/agents.ts`

Tasks:

- Read profile directories under `<user-home>/.hermes/profiles`.
- Detect directors such as `notion-director`, `cozyhub-director`, `intel-hub-director`, `risk-hub-director`, `mcp-director`, `govcon-director`, and `contract-hub-director`.
- Group directors into teams using a small explicit mapping file or future editable config.
- Show each team with model route, enabled tools, secrets references, active sessions, and Kanban items.

Success criteria:

- Teams appear even if some profiles have partial config.
- Missing or malformed profiles show as degraded, not blank.
- No secret values are exposed in the team card.

## Workstream 4: Secrets and Tools Visibility

Objective: Let the user see which secrets/tools exist and where they are used without leaking values.

Suggested owner: security-conscious backend agent

Likely files:

- `src/main/security.ts`
- `src/main/config.ts`
- `src/main/tools.ts`
- `src/preload/index.ts`
- `src/renderer/src/screens`

Tasks:

- Inventory expected secret names from Hermes config, profile `.env` files, and provider/tool config.
- Display secret status as present, missing, duplicate, or stale.
- Redact values by default.
- Require an explicit reveal action if reveal is added later.
- Add warnings for plaintext files that should not be committed.

Success criteria:

- Notion API key and other provider secrets can be seen as present/missing.
- No raw key is printed in logs, UI, tests, or Notion.
- Secrets panel is useful for debugging missing agent capability.

## Workstream 5: Sessions and Multi-Conversation Control

Objective: Make the session layer reliable and allow many conversations at once.

Suggested owner: chat/session agent

Likely files:

- `src/main/sessions.ts`
- `src/main/session-cache.ts`
- `src/main/session-state.ts`
- `src/renderer/src/screens`
- `tests/session-cache-sync.test.ts`
- `tests/remote-history.test.ts`
- `tests/preload-api-surface.test.ts`

Tasks:

- Preserve request-scoped IPC behavior.
- Show active, pinned, stale, and errored sessions in Mission Control.
- Make pinned tabs visible and testable.
- Add timeout and empty-state handling so Sessions cannot hang forever.

Success criteria:

- Sessions tab and Mission Control session panel load without hanging.
- Multiple conversations can remain open.
- Pinned tabs persist across restart.

## Workstream 6: Kanban and Task Queue

Objective: Keep one integrated Kanban surface and connect it to Mission Control.

Suggested owner: Kanban agent

Likely files:

- `src/main/kanban.ts`
- `src/renderer/src/screens`
- `src/shared/i18n/locales/en/kanban.ts`

Tasks:

- Ensure only one Kanban board renders.
- Add a compact Mission Control summary of pending, running, completed, and blocked tasks.
- Preserve Notion-derived task labels where available.
- Keep the full Kanban tab for detailed work.

Success criteria:

- No duplicate boards.
- Kanban loads from current session state.
- Mission Control shows task counts and top actionable items.

## Workstream 7: Project Room and Notion Sync

Objective: Surface the local Project Room and create a clean Notion reporting loop.

Suggested owner: Notion/documentation agent

Likely files:

- `src/main/memory.ts`
- `src/main/config.ts`
- `src/renderer/src/screens`
- Notion page under `Hermes Setup`

Tasks:

- Read the Project Room pointer at `<user-home>/.hermes/project-room`.
- Surface Source Inventory, Conflict Log, Missing Context, Duplicates Report, and Guardrails as links/status panels.
- Add a Notion sync proposal before implementing writes.
- First Notion sync should publish summaries, not raw secrets or full logs.

Success criteria:

- User can see Project Room health from the app.
- Notion contains a readable build/status page.
- No sensitive local data is copied into Notion without review.

## Workstream 8: Packaging and Lab Build

Objective: Build and install the Mission Control lab app without overwriting the main app.

Suggested owner: build/release agent

Likely files:

- `electron-builder.yml`
- `package.json`
- `dev-app-update.yml`
- build scripts

Tasks:

- Add or document a lab build/install command that produces `Hermes Mission Control Lab.app`.
- Ensure bundle name and identifier are distinct from the main app.
- Confirm auto-update behavior cannot accidentally replace the main app.
- Keep fork update instructions clear.

Success criteria:

- `npm run build:unpack:local` succeeds.
- Lab app can be launched independently.
- Main `/Applications/Hermes Agent.app` remains untouched unless explicitly replaced.

## Verification Plan

Run these after meaningful changes:

```bash
npm run typecheck
npm test -- tests/preload-api-surface.test.ts tests/session-cache-sync.test.ts tests/remote-history.test.ts
npm run build:unpack:local
```

Manual checks:

- Launch `/Applications/Hermes Mission Control Lab.app`.
- Confirm Mission Control renders.
- Confirm Chat, Sessions, Kanban, Models, Providers, Settings remain readable.
- Confirm Sessions does not hang.
- Confirm multiple conversation tabs and pinned tabs are usable.
- Confirm secrets panel redacts values.
- Confirm Notion summary content does not include raw tokens or local-only sensitive logs.

## Agent Handoff Prompt Template

Use this prompt for each helper agent:

```text
You are working on Hermes Desktop Mission Control Lab.

Repo: <local-hermes-desktop-repo>
Branch: codex/mission-control-lab
Planning doc: <local-hermes-desktop-repo>/docs/mission-control-lab-build-plan.md
Lab app: /Applications/Hermes Mission Control Lab.app
Main app: /Applications/Hermes Agent.app

Your assigned workstream is: [paste one workstream section].

Rules:
- Do not overwrite user Hermes config, profile files, secrets, sessions, or the main installed app.
- Do not expose raw secret values in UI, logs, tests, or Notion.
- Keep source, installed app, runtime, and profile config boundaries separate.
- Preserve current Kanban, session sync, multi-tab chat, theme, and provider routing behavior.
- Before editing, inspect relevant files and summarize your intended changes.
- After editing, run the smallest relevant tests, then report exact files changed and verification results.

Success criteria:
- Your workstream acceptance criteria pass.
- `npm run typecheck` still passes, or you explain the remaining failure precisely.
- The app remains usable as a lab build without replacing the main Hermes app.
```

## First Implementation Order

1. Build the read-only status API.
2. Add Mission Control shell and dashboard.
3. Add agent teams inventory.
4. Add secrets/tools visibility with redaction.
5. Stabilize sessions and pinned tabs.
6. Integrate Kanban summary.
7. Add Project Room panels.
8. Add Notion summary sync after the local UI is truthful.
