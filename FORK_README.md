# 🐱 Hermes OS — Fork

A customized fork of [Hermes Desktop](https://github.com/fathah/hermes-desktop) with branding, UI consolidation, and quality-of-life improvements.

## What's Different in This Fork

| Feature | Upstream | This Fork |
|---------|----------|-----------|
| **Branding** | Hermes Agent | Hermes OS with custom cat icon & banner |
| **Sidebar** | Separate Models, Skills, Tools, Persona tabs | Models → Providers, Skills+Tools → Toolkit, Persona → Teams |
| **Teams** | Profiles list | Team grouping with director/worker hierarchy + inline SOUL.md editor |
| **Signal Gateway** | Missing config fields | Fixed: `SIGNAL_HTTP_URL` + `SIGNAL_ACCOUNT` fields added |
| **Team Logic** | Hardcoded role names | Generic — any user-created team structure works |

## Install (macOS)

### Fresh Install

```bash
git clone https://github.com/ItsMalware/hermes-desktop.git
cd hermes-desktop
git checkout codex/mission-control-lab
npm install
npm run build:unpack:local
open "dist/mac-arm64/Hermes Agent.app"
```

To copy to Applications:

```bash
osascript -e 'quit app "Hermes Agent"' || true
rm -rf "/Applications/Hermes Agent.app"
ditto "dist/mac-arm64/Hermes Agent.app" "/Applications/Hermes Agent.app"
xattr -dr com.apple.quarantine "/Applications/Hermes Agent.app" 2>/dev/null || true
open "/Applications/Hermes Agent.app"
```

### Update an Existing Install

```bash
cd hermes-desktop
git pull --ff-only
npm install
npm run build:unpack:local
osascript -e 'quit app "Hermes Agent"' || true
rm -rf "/Applications/Hermes Agent.app"
ditto "dist/mac-arm64/Hermes Agent.app" "/Applications/Hermes Agent.app"
xattr -dr com.apple.quarantine "/Applications/Hermes Agent.app" 2>/dev/null || true
open "/Applications/Hermes Agent.app"
```

## Install (Windows)

### Fresh Install

```powershell
git clone https://github.com/ItsMalware/hermes-desktop.git
cd hermes-desktop
git checkout codex/mission-control-lab
npm install
npm run build:win
```

Run the installer from `dist/`. Windows SmartScreen may warn on first launch — click **"More info"** → **"Run anyway"**.

### Update an Existing Install

```powershell
cd hermes-desktop
git pull --ff-only
npm install
npm run build:win
```

Run the new installer from `dist/` — it will update in place.

## Sync with Upstream

Keep this fork up to date with the original Hermes Desktop releases:

```bash
git remote add upstream https://github.com/fathah/hermes-desktop.git 2>/dev/null || true
git fetch upstream
git checkout codex/mission-control-lab
git merge upstream/main
npm install
npm run typecheck
git push origin codex/mission-control-lab
```

Resolve any merge conflicts in source files, rebuild, and verify.

## Development

```bash
npm install
npm run dev      # Start dev server with hot reload
npm run lint     # Run linter
npm run typecheck # Type check
npm test         # Run tests
```

## Data Storage

Hermes runtime data lives in `~/.hermes/` (separate from the app). Reinstalling or updating the app does **not** touch your profiles, sessions, API keys, kanban data, or memory.

| Path | Contents |
|------|----------|
| `~/.hermes/.env` | API keys and gateway config |
| `~/.hermes/config.yaml` | Core settings |
| `~/.hermes/SOUL.md` | Default persona |
| `~/.hermes/profiles/` | Agent profiles (teams) |
| `~/.hermes/state.db` | Session history |
| `~/.hermes/cron/jobs.json` | Scheduled tasks |

## Credits

Based on [Hermes Desktop](https://github.com/fathah/hermes-desktop) by [fathah](https://github.com/fathah), built for [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research.
