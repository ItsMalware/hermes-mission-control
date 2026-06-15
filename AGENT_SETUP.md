# Hermes Mission Control — Agent Setup Guide

> **Audience:** AI coding agents helping humans set up Hermes Mission Control.
> This document contains deterministic, step-by-step instructions for every integration.
> All commands are explicit and copy-pasteable. All paths are real.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [First Launch Walkthrough](#first-launch-walkthrough)
4. [Provider Setup](#provider-setup)
5. [MCP Server Setup](#mcp-server-setup)
6. [Gateway & Messaging Platforms](#gateway--messaging-platforms)
7. [Email Connection](#email-connection)
8. [Notion Integration](#notion-integration)
9. [Mobile & Chat Gateway Setup](#mobile--chat-gateway-setup)
10. [Profile Management](#profile-management)
11. [Connection Modes](#connection-modes)
12. [Troubleshooting](#troubleshooting)
13. [Environment Variables Reference](#environment-variables-reference)
14. [File & Directory Reference](#file--directory-reference)

---

## Prerequisites

### Required Software

| Software    | Minimum Version | Purpose                        | Check Command              |
|-------------|-----------------|--------------------------------|----------------------------|
| Node.js     | 22+             | Building from source           | `node --version`           |
| npm         | (bundled)       | Package management             | `npm --version`            |
| Python      | 3.11+           | Hermes Agent backend           | `python3 --version`        |
| Git         | 2.30+           | Cloning & updating             | `git --version`            |
| uv          | latest          | Python package manager (auto-installed) | `uv --version`   |

### Platform-Specific Prerequisites

#### macOS

```bash
# Install Xcode Command Line Tools (required for native modules)
xcode-select --install
```

#### Windows

```powershell
# Option A: Install Visual Studio Build Tools (for native module compilation)
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Select "Desktop development with C++" workload

# Option B: Windows Terminal is recommended for better CLI experience
# Install from: https://aka.ms/terminal
```

#### Linux (Debian/Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y build-essential libsecret-1-dev libgtk-3-dev
```

#### Linux (Fedora/RHEL)

```bash
sudo dnf groupinstall "Development Tools"
sudo dnf install libsecret-devel gtk3-devel
```

#### Linux (Arch)

```bash
sudo pacman -S base-devel libsecret gtk3
```

---

## Installation

### Option 1: Download Release (Recommended for End Users)

| Platform | Format      | Source                                                                 |
|----------|-------------|------------------------------------------------------------------------|
| macOS    | `.dmg`      | [GitHub Releases](https://github.com/ItsMalware/hermes-mission-control/releases)   |
| Windows  | `.exe` (NSIS installer) or portable `.exe` | [GitHub Releases](https://github.com/ItsMalware/hermes-mission-control/releases) |
| Linux    | `.AppImage`, `.deb`, `.rpm`, `.snap` | [GitHub Releases](https://github.com/ItsMalware/hermes-mission-control/releases) |

**Post-download steps by platform:**

```bash
# macOS: If "App is damaged" error appears
xattr -cr /Applications/Hermes\ Mission\ Control.app

# Linux: Make AppImage executable
chmod +x Hermes*.AppImage

# Windows: If SmartScreen blocks → Click 'More info' → 'Run anyway'
```

### Option 2: Build from Source

```bash
# 1. Clone the repository
git clone https://github.com/ItsMalware/hermes-mission-control.git
cd hermes-mission-control

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run dev

# 4. Build for production (pick your platform)
npm run build:mac      # macOS (.dmg)
npm run build:win      # Windows (.exe NSIS installer)
npm run build:linux    # Linux (.AppImage, .snap, .deb, .rpm)

# Alternative: Build unpacked (no installer, for testing)
npm run build:unpack

# If native modules fail after npm install
npm run postinstall    # Rebuilds native deps (better-sqlite3, etc.)

# Rebuild native modules explicitly
npm run rebuild:native # Runs: electron-rebuild -f -w better-sqlite3
```

**Build scripts reference:**

| Command                  | Description                                          |
|--------------------------|------------------------------------------------------|
| `npm run dev`            | Development mode with hot reload                     |
| `npm run dev:fresh`      | Dev mode with a fresh temporary HERMES_HOME           |
| `npm run build`          | Typecheck + compile (no packaging)                    |
| `npm run build:mac`      | Production macOS build                                |
| `npm run build:win`      | Production Windows build                              |
| `npm run build:linux`    | Production Linux build                                |
| `npm run build:rpm`      | Linux RPM only                                        |
| `npm run build:unpack`   | Compile + unpack (no installer)                       |
| `npm run test`           | Run vitest test suite                                 |
| `npm run lint`           | ESLint check                                          |
| `npm run typecheck`      | TypeScript type checking (node + web)                 |

---

## First Launch Walkthrough

The app follows this sequence on first launch:

```
┌──────────────────────────────────────────────────────┐
│  1. App checks for hermes-agent installation         │
│     → Looks for Python venv at ~/.hermes/hermes-agent│
│                                                      │
│  2. If NOT found:                                    │
│     → Downloads & runs official install script        │
│     → macOS/Linux: curl install.sh | bash            │
│     → Windows: install.ps1 via PowerShell            │
│     → Installs: uv, Python, hermes-agent, venv       │
│     → 7-step progress bar                            │
│                                                      │
│  3. Provider selection wizard                        │
│     → Choose an AI provider from the list            │
│     → Enter API key (or use OAuth)                   │
│                                                      │
│  4. Main app loads                                   │
│     → Chat interface ready                           │
│     → Settings accessible via sidebar                │
└──────────────────────────────────────────────────────┘
```

**Install stages (as shown in the progress UI):**

1. Checking prerequisites (git, uv, python, node, ripgrep, ffmpeg)
2. Setting up package manager (uv)
3. Setting up Python
4. Downloading Hermes OS (git clone hermes-agent)
5. Creating Python environment (venv)
6. Installing dependencies (pip packages)
7. Finishing setup

**HERMES_HOME resolution order:**

| Priority | Source                          | Path                                |
|----------|---------------------------------|-------------------------------------|
| 1        | `HERMES_HOME` env var           | User-defined                        |
| 2        | User override file              | `<userData>/hermes-home.json`       |
| 3 (Win)  | Probed `%LOCALAPPDATA%\hermes`  | If hermes data exists there         |
| 3 (Win)  | Probed `~/.hermes`              | If hermes data exists there         |
| 4 (Win)  | Default                         | `%LOCALAPPDATA%\hermes`             |
| 4 (mac/linux) | Default                    | `~/.hermes`                         |

---

## Provider Setup

### API Key Providers

Configure these in the Setup Wizard on first launch, or later via **Settings → API Keys**.

| Provider         | Env Variable          | API Key URL                                          | Key Prefix   | Base URL                                     |
|------------------|-----------------------|------------------------------------------------------|--------------|----------------------------------------------|
| **OpenRouter** ⭐ | `OPENROUTER_API_KEY`  | https://openrouter.ai/keys                           | `sk-or-v1-`  | `https://openrouter.ai/api/v1`               |
| Anthropic        | `ANTHROPIC_API_KEY`   | https://console.anthropic.com/settings/keys          | `sk-ant-`    | Native (not OpenAI-compatible)               |
| OpenAI           | `OPENAI_API_KEY`      | https://platform.openai.com/api-keys                 | `sk-`        | `https://api.openai.com/v1`                  |
| Google AI Studio | `GOOGLE_API_KEY`      | https://aistudio.google.com/app/apikey               | `AIza`       | Native                                       |
| Google Gemini    | `GEMINI_API_KEY`      | https://aistudio.google.com/app/apikey               | `AIza`       | Native                                       |
| xAI (Grok)       | `XAI_API_KEY`         | https://console.x.ai                                 | `xai-`       | Native                                       |
| DeepSeek         | `DEEPSEEK_API_KEY`    | https://platform.deepseek.com/                       | —            | `https://api.deepseek.com/v1`                |
| Groq             | `GROQ_API_KEY`        | https://console.groq.com/keys                        | —            | `https://api.groq.com/openai/v1`             |
| Together AI      | `TOGETHER_API_KEY`    | https://api.together.xyz/settings/api-keys           | —            | `https://api.together.xyz/v1`                |
| Fireworks AI     | `FIREWORKS_API_KEY`   | https://fireworks.ai/api-keys                        | —            | `https://api.fireworks.ai/inference/v1`      |
| Mistral          | `MISTRAL_API_KEY`     | https://console.mistral.ai/api-keys                  | —            | `https://api.mistral.ai/v1`                  |
| Cerebras         | `CEREBRAS_API_KEY`    | https://cloud.cerebras.ai/                           | —            | `https://api.cerebras.ai/v1`                 |
| Perplexity       | `PERPLEXITY_API_KEY`  | https://www.perplexity.ai/settings/api               | —            | `https://api.perplexity.ai/v1`               |
| Hugging Face     | `HF_TOKEN`            | https://huggingface.co/settings/tokens               | `hf_`        | `https://api-inference.huggingface.co`       |
| Ollama Cloud     | `OLLAMA_API_KEY`      | https://ollama.com/settings/keys                     | `ollama_`    | `https://ollama.com/v1`                      |
| Xiaomi MiMo      | `XIAOMI_API_KEY`      | https://platform.xiaomimimo.com                      | `sk-`        | `https://api.xiaomimimo.com/v1`              |
| NVIDIA NIM       | `NVIDIA_API_KEY`      | https://build.nvidia.com/                            | —            | —                                            |
| Nous Research    | `NOUS_API_KEY`        | Nous Portal                                          | —            | Native                                       |

> ⭐ **OpenRouter is recommended** — access to 200+ models from all providers through a single API key.

### OAuth / Subscription Providers (No API Key Needed)

These providers authenticate via browser-based OAuth login. In Hermes, they appear as "Sign in" cards on the Providers page.

| Provider              | Provider ID           | Auth Method      | Setup                                    |
|-----------------------|-----------------------|------------------|------------------------------------------|
| Google Gemini CLI     | `google-gemini-cli`   | OAuth            | Sign in via browser; uses `cloudcode-pa://google` protocol |
| OpenAI Codex          | `openai-codex`        | OAuth            | Requires ChatGPT Codex subscription      |
| xAI Grok (OAuth)      | `xai-oauth`           | OAuth            | Sign in via browser                      |
| Qwen (OAuth)          | `qwen-oauth`          | OAuth            | Sign in via browser                      |
| MiniMax (OAuth)       | `minimax-oauth`       | OAuth            | Sign in via browser                      |
| Nous Portal (OAuth)   | `nous`                | OAuth Device Code| Sign in via browser                      |

### Local LLM Providers (No API Key Needed)

| Provider     | Provider ID  | Default Base URL                 |
|--------------|--------------|----------------------------------|
| Ollama       | `ollama`     | `http://localhost:11434/v1`      |
| LM Studio    | `lmstudio`   | `http://localhost:1234/v1`       |
| llama.cpp    | `llamacpp`   | `http://localhost:8080/v1`       |
| vLLM         | `vllm`       | `http://localhost:8000/v1`       |
| AtomicChat   | `atomicchat` | `http://localhost:1337/v1`       |

**To set up a local provider:**

1. Install and start your local LLM server (e.g., `ollama serve`)
2. In Hermes, select the provider from the dropdown
3. No API key is needed — the base URL auto-populates
4. Select your model

### Custom OpenAI-Compatible Endpoint

For any provider not in the list above:

1. In Hermes, select **"Custom (OpenAI Compatible)"** from the provider dropdown
2. Enter the base URL (e.g., `https://your-proxy.example.com/v1`)
3. Enter the API key as `CUSTOM_API_KEY` in **Settings → API Keys**
4. Hermes will auto-detect the correct env var if the URL matches a known provider hostname

---

## MCP Server Setup

### What Are MCP Servers?

MCP (Model Context Protocol) servers extend Hermes with external tools — file access, databases, APIs, custom functions, etc. They run as child processes (stdio) or HTTP services and expose tools that the LLM can call.

### How to Add MCP Servers

**Path:** Settings → Capabilities → Tools (MCP Servers)

#### Option A: Add via UI

1. Open **Settings → Capabilities → Tools**
2. Click **"Add Server"**
3. Choose transport type:
   - **stdio** — runs a local command (most common)
   - **http** — connects to a running HTTP/SSE endpoint

#### Option B: Add via config.yaml

MCP servers are stored in `~/.hermes/config.yaml` (or the active profile's config). The format:

```yaml
mcp:
  servers:
    filesystem:
      type: stdio
      command: npx
      args:
        - -y
        - "@modelcontextprotocol/server-filesystem"
        - "/Users/username/Documents"
      env: {}

    remote-db:
      type: http
      url: "http://localhost:3001/mcp"
      auth: "Bearer my-token"
```

#### Stdio Transport Example (Filesystem Server)

```yaml
# In config.yaml under mcp.servers:
filesystem:
  type: stdio
  command: npx
  args:
    - -y
    - "@modelcontextprotocol/server-filesystem"
    - "/path/to/allowed/directory"
```

#### HTTP Transport Example

```yaml
# In config.yaml under mcp.servers:
my-api:
  type: http
  url: "http://localhost:8080/mcp"
  auth: "Bearer YOUR_TOKEN_HERE"
```

### Using the MCP Marketplace / Discover

1. Open **Settings → Capabilities → Tools**
2. Click **"Discover"** or **"Marketplace"**
3. Browse the MCP server registry
4. Click **"Install"** on any server
5. Fill in required environment variables when prompted
6. The server is auto-added to your config and started

### Server Name Rules

- Must start with a letter or digit
- Only letters, digits, hyphens (`-`), and underscores (`_`) allowed
- Pattern: `^[A-Za-z0-9][A-Za-z0-9_-]*$`

---

## Gateway & Messaging Platforms

The **Gateway** is the subsystem that connects Hermes to external messaging platforms. It runs as a background process alongside the main Hermes agent.

**Key concepts:**
- Each platform has **required** and **optional** env vars
- Platforms are **enabled/disabled** independently
- The gateway must be **started** after configuring platforms
- Each platform supports configurable **toolsets** (what the agent can do from that platform)

### Available Toolsets Per Platform

| Toolset          | Risk   | Description                                          | Default |
|------------------|--------|------------------------------------------------------|---------|
| `web`            | normal | Web search via configured backend                    | ✅      |
| `browser`        | normal | Live browser session                                 | ❌      |
| `terminal`       | **high** | Run shell commands from messaging                  | ❌      |
| `file`           | **high** | Read/write files from messaging                    | ❌      |
| `code_execution` | **high** | Run local code from messaging                      | ❌      |
| `vision`         | normal | Analyze images sent via messaging                    | ✅      |
| `image_gen`      | normal | Generate images from messaging                       | ❌      |
| `tts`            | normal | Text-to-speech responses                             | ✅      |
| `skills`         | normal | List/manage Hermes skills                            | ✅      |
| `memory`         | normal | Read/update Hermes memory                            | ✅      |
| `session_search` | normal | Search previous sessions                             | ✅      |
| `clarify`        | normal | Ask clarification questions                          | ✅      |
| `cronjob`        | normal | Create/manage scheduled jobs                         | ✅      |
| `todo`           | normal | Manage task lists                                    | ✅      |
| `messaging`      | normal | Send messages to other platforms                     | ✅      |
| `kanban`         | normal | Read/manage kanban tasks                             | ✅      |
| `delegation`     | normal | Delegate work to other agents                        | ❌      |
| `moa`            | normal | Mixture-of-agents consensus                          | ❌      |

---

## Email Connection

**Path:** Settings → Gateway → Add Platform → Email

### Step-by-Step

1. Navigate to **Settings → Gateway**
2. Click **Add Platform → Email**
3. Configure the following **required** environment variables:

| Variable          | Description                     | Gmail Example          | Outlook Example            |
|-------------------|---------------------------------|------------------------|----------------------------|
| `EMAIL_ADDRESS`   | Your email address              | `you@gmail.com`        | `you@outlook.com`          |
| `EMAIL_PASSWORD`  | App password (**NOT** regular)  | 16-char app password   | App password               |
| `EMAIL_IMAP_HOST` | IMAP server hostname            | `imap.gmail.com`       | `outlook.office365.com`    |
| `EMAIL_SMTP_HOST` | SMTP server hostname            | `smtp.gmail.com`       | `smtp.office365.com`       |

### Gmail: Generate App Password

```
1. Go to https://myaccount.google.com/security
2. Ensure 2-Step Verification is ENABLED
3. Go to https://myaccount.google.com/apppasswords
4. Select app: "Mail"
5. Select device: "Other (Custom name)" → enter "Hermes"
6. Click "Generate"
7. Copy the 16-character password (spaces are ignored)
8. Paste into EMAIL_PASSWORD in Hermes
```

> ⚠️ **CRITICAL:** Never use your regular Gmail password. It will not work and is a security risk. You MUST use an App Password.

### Outlook / Microsoft 365

```
1. Go to https://account.live.com/proofs/manage
2. Enable Two-step verification if not already
3. Go to https://account.live.com/proofs/AppPassword
4. Create a new app password
5. Copy and paste into EMAIL_PASSWORD
```

### Start the Gateway

After configuration:
1. Toggle the Email platform **ON**
2. Click **Start Gateway** (or restart if already running)
3. Check status — should show **"connected"**

---

## Notion Integration

Hermes can pull tasks from a Notion database via the `NOTION_API_KEY` and display them in the **Workspace → Notion Tickets** panel.

### Step-by-Step

```
1. Go to https://www.notion.so/my-integrations
2. Click "+ New integration"
3. Name it (e.g., "Hermes Agent")
4. Select the workspace
5. Set capabilities: Read content, Read comments (minimum)
6. Click "Submit" → copy the "Internal Integration Secret"
   (starts with `ntn_` or `secret_`)
```

**In Hermes:**

1. Go to **Settings → API Keys**
2. Find `NOTION_API_KEY` (or `NOTION_TOKEN`)
3. Paste the integration secret
4. **Share your Notion database** with the integration:
   - Open the database in Notion
   - Click **"Share"** → **"Invite"**
   - Search for your integration name → click **"Invite"**
5. **Get the database ID:**
   - Open the database as a full page in Notion
   - Copy the URL: `https://www.notion.so/<workspace>/<DATABASE_ID>?v=...`
   - The database ID is the 32-character hex string before `?v=`
6. Go to **Workspace → Notion Tickets**
7. Enter the database ID

> The integration reads properties: Title, Status, Priority, Completion Date, Notes, Queue.

---

## Mobile & Chat Gateway Setup

### Telegram

**Required env:** `TELEGRAM_BOT_TOKEN`
**Optional env:** `TELEGRAM_ALLOWED_USERS`, `TELEGRAM_PROXY`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram/

```
1. Open Telegram → search for @BotFather
2. Send /newbot
3. Follow prompts to name your bot
4. BotFather returns a token like: 123456789:ABCdefGHI-jklMNOpqrSTUvwx
5. In Hermes: Settings → Gateway → Add Platform → Telegram
6. Paste the bot token into TELEGRAM_BOT_TOKEN
7. (Optional) Set TELEGRAM_ALLOWED_USERS to restrict access
   → Comma-separated Telegram user IDs
8. Enable the platform → Start Gateway
9. Message your bot from Telegram to test
```

### Discord

**Required env:** `DISCORD_BOT_TOKEN`
**Optional env:** `DISCORD_ALLOWED_USERS`, `DISCORD_ALLOWED_CHANNELS`, `DISCORD_REPLY_TO_MODE`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord/

```
1. Go to https://discord.com/developers/applications
2. Click "New Application" → name it → Create
3. Go to "Bot" in sidebar
4. Click "Reset Token" → copy the bot token
5. IMPORTANT: Enable "MESSAGE CONTENT INTENT" under Privileged Gateway Intents
6. Go to "OAuth2" → "URL Generator"
7. Select scopes: bot
8. Select permissions: Send Messages, Read Message History, etc.
9. Copy the generated URL → open in browser → add bot to your server
10. In Hermes: Settings → Gateway → Add Platform → Discord
11. Paste the bot token into DISCORD_BOT_TOKEN
12. (Optional) Set DISCORD_ALLOWED_USERS for access control
13. Enable the platform → Start Gateway
```

### Slack

**Required env:** `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack/

```
1. Go to https://api.slack.com/apps → "Create New App" → "From scratch"
2. Enable Socket Mode:
   → Settings → Socket Mode → Toggle ON
   → Generate an app-level token (xapp-...) → copy it
3. Add Bot Scopes under OAuth & Permissions:
   - chat:write
   - app_mentions:read
   - channels:history
   - groups:history
   - im:history
   - mpim:history
4. Install the app to your workspace
5. Copy the Bot User OAuth Token (xoxb-...)
6. In Hermes:
   → SLACK_BOT_TOKEN = xoxb-... (Bot token)
   → SLACK_APP_TOKEN = xapp-... (App-level token)
7. Enable the platform → Start Gateway
```

### WhatsApp

**Required env:** (none — QR-based auth)
**Optional env:** `WHATSAPP_ALLOWED_USERS`, `WHATSAPP_MODE`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp/

```
1. In Hermes: Settings → Gateway → Add Platform → WhatsApp
2. Enable the platform → Start Gateway
3. A QR code will appear in the Hermes UI
4. Open WhatsApp on your phone
5. Go to Settings → Linked Devices → Link a Device
6. Scan the QR code
7. Your agent is now reachable via WhatsApp
```

> ⚠️ WhatsApp requires no API credentials — it uses a local bridge with QR code linking.

### Signal

**Required env:** `SIGNAL_HTTP_URL`, `SIGNAL_ACCOUNT`
**Optional env:** `SIGNAL_ALLOWED_USERS`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/signal/

```
1. Install signal-cli REST API (Docker recommended):
   docker run -d --name signal-api \
     -p 8080:8080 \
     -v $HOME/.local/share/signal-cli:/home/.local/share/signal-cli \
     bbernhard/signal-cli-rest-api

2. Register or link your Signal number via the API:
   # Register new number:
   curl -X POST 'http://localhost:8080/v1/register/+1234567890'
   # Or link to existing Signal (scan QR):
   curl -X GET 'http://localhost:8080/v1/qrcodelink?device_name=hermes'

3. In Hermes: Settings → Gateway → Add Platform → Signal
4. Set:
   → SIGNAL_HTTP_URL = http://127.0.0.1:8080
   → SIGNAL_ACCOUNT = +1234567890 (your registered number)
5. Enable the platform → Start Gateway
```

> Reference: https://github.com/bbernhard/signal-cli-rest-api

### iMessage (macOS Only, via BlueBubbles)

**Required env:** `BLUEBUBBLES_SERVER_URL`, `BLUEBUBBLES_PASSWORD`
**Optional env:** `BLUEBUBBLES_ALLOWED_USERS`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/bluebubbles/

```
1. Download and install BlueBubbles server on your Mac
   → https://bluebubbles.app/
2. Set up BlueBubbles:
   → Sign in with your Apple ID
   → Configure the server with a password
   → Note the server URL (usually http://localhost:1234)
3. In Hermes: Settings → Gateway → Add Platform → BlueBubbles (iMessage)
4. Set:
   → BLUEBUBBLES_SERVER_URL = http://localhost:1234 (your server URL)
   → BLUEBUBBLES_PASSWORD = your-server-password
5. (Optional) Set BLUEBUBBLES_ALLOWED_USERS (comma-separated phone/email)
6. Enable the platform → Start Gateway
```

> ⚠️ macOS only. Requires a Mac running BlueBubbles server with an active Apple ID signed into iMessage.

### SMS (Twilio)

**Required env:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
**Optional env:** `TWILIO_PHONE_NUMBER`, `SMS_PROVIDER`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/sms/

```
1. Create a Twilio account at https://www.twilio.com
2. Go to https://www.twilio.com/console
3. Copy your Account SID and Auth Token from the dashboard
4. Buy a phone number (or use the trial number)
5. In Hermes: Settings → Gateway → Add Platform → SMS (Twilio)
6. Set:
   → TWILIO_ACCOUNT_SID = your Account SID
   → TWILIO_AUTH_TOKEN = your Auth Token
   → TWILIO_PHONE_NUMBER = +1234567890 (your Twilio number)
7. Enable the platform → Start Gateway
```

### Mattermost

**Required env:** `MATTERMOST_URL`, `MATTERMOST_TOKEN`
**Optional env:** `MATTERMOST_ALLOWED_USERS`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/mattermost/

```
1. In Mattermost, go to Profile → Security → Personal Access Tokens
2. Create a token → copy it
3. In Hermes: Settings → Gateway → Add Platform → Mattermost
4. Set:
   → MATTERMOST_URL = https://your-mattermost.example.com
   → MATTERMOST_TOKEN = your-personal-access-token
5. Enable the platform → Start Gateway
```

### Matrix

**Required env:** `MATRIX_HOMESERVER`, `MATRIX_ACCESS_TOKEN`, `MATRIX_USER_ID`
**Optional env:** `MATRIX_ALLOWED_USERS`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/matrix/

```
1. Create a Matrix bot account or use your own
2. Get an access token (e.g., via Element's DevTools or API)
3. In Hermes: Settings → Gateway → Add Platform → Matrix
4. Set:
   → MATRIX_HOMESERVER = https://matrix.org (or your homeserver URL)
   → MATRIX_USER_ID = @hermes:matrix.org
   → MATRIX_ACCESS_TOKEN = your-access-token
5. Enable the platform → Start Gateway
```

### Home Assistant

**Required env:** `HASS_URL`, `HASS_TOKEN`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/homeassistant/

```
1. In Home Assistant: Profile → Long-Lived Access Tokens → Create Token
2. Copy the token
3. In Hermes: Settings → Gateway → Add Platform → Home Assistant
4. Set:
   → HASS_URL = https://homeassistant.local:8123 (your HA URL)
   → HASS_TOKEN = your-long-lived-access-token
5. Enable the platform → Start Gateway
```

### DingTalk

**Required env:** `DINGTALK_CLIENT_ID`, `DINGTALK_CLIENT_SECRET`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/dingtalk/

### Feishu / Lark

**Required env:** `FEISHU_APP_ID`, `FEISHU_APP_SECRET`
**Optional env:** `FEISHU_ENCRYPT_KEY`, `FEISHU_VERIFICATION_TOKEN`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/feishu/

### WeCom (Group Bot)

**Required env:** `WECOM_BOT_ID`
**Optional env:** `WECOM_SECRET`, `WECOM_CORP_ID`, `WECOM_AGENT_ID`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/wecom/

### WeCom (App / Callback)

**Required env:** `WECOM_CALLBACK_CORP_ID`, `WECOM_CALLBACK_CORP_SECRET`, `WECOM_CALLBACK_AGENT_ID`
**Optional env:** `WECOM_CALLBACK_TOKEN`, `WECOM_CALLBACK_ENCODING_AES_KEY`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/wecom-callback/

### WeChat (Official Account)

**Required env:** `WEIXIN_ACCOUNT_ID`, `WEIXIN_TOKEN`
**Optional env:** `WEIXIN_BASE_URL`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/weixin/

### QQ Bot

**Required env:** `QQ_APP_ID`, `QQ_CLIENT_SECRET`
**Optional env:** `QQ_ALLOWED_USERS`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/qqbot/

### API Server (OpenAI-Compatible)

Expose Hermes as an OpenAI-compatible HTTP API (for Open WebUI, etc.)

**Required env:** (none)
**Optional env:** `API_SERVER_ENABLED`, `API_SERVER_KEY`, `API_SERVER_PORT`, `API_SERVER_HOST`, `API_SERVER_MODEL_NAME`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/open-webui/

```yaml
# Enable in config.yaml or via Gateway UI:
API_SERVER_ENABLED=true
API_SERVER_KEY=your-bearer-token
API_SERVER_PORT=8000
```

### Webhooks

Receive events from GitHub, GitLab, and other webhook sources.

**Optional env:** `WEBHOOK_ENABLED`, `WEBHOOK_PORT`, `WEBHOOK_SECRET`
**Docs:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/webhooks/

---

## Profile Management

Profiles allow running multiple Hermes configurations simultaneously — different models, providers, personalities, and gateway setups.

### File Layout

```
~/.hermes/
├── config.yaml          # Default profile config
├── .env                 # Default profile API keys
├── auth.json            # Default profile OAuth credentials
├── active_profile       # File containing active profile name
└── profiles/
    ├── researcher/
    │   ├── config.yaml
    │   ├── .env
    │   └── auth.json
    └── coder/
        ├── config.yaml
        ├── .env
        └── auth.json
```

### Profile Roles

| Role         | Description                                |
|--------------|--------------------------------------------|
| `general`    | Default role for the default profile       |
| `director`   | Team lead — manages and delegates to workers |
| `worker`     | Executes tasks assigned by directors       |
| `assistant`  | General assistant role                     |
| `specialist` | Domain-specific expert                     |

### Creating Profiles via CLI

```bash
# Create a new profile
~/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main profile create researcher

# Switch to a profile
~/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main profile switch researcher

# List profiles
~/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main profile list
```

### Creating Profiles via UI

1. Go to **Settings → Profiles** (or the profile selector in the sidebar)
2. Click **"Create Profile"**
3. Enter a name (letters, digits, hyphens, underscores only)
4. Configure model, provider, and personality
5. The profile gets its own `.env`, `config.yaml`, and `auth.json`

### Team / Worker Pool Setup

```yaml
# In a director profile's config.yaml:
role: director
team: engineering

# Point to a directory of worker profile configs
WORKER_POOL_PATH: /Users/username/.hermes/profiles
```

### Profile Name Rules

- Must start with a letter or digit
- Only letters, digits, hyphens, and underscores allowed
- `default` is reserved for the built-in default profile

### CEO Assignment (3D Office)

In the 3D Office view:
1. Open the Office (sidebar → Office icon)
2. Profiles appear as agents seated at desks
3. Drag a profile to the CEO chair to make it the primary
4. The CEO profile receives inbound messages when no specific profile is targeted

---

## Connection Modes

Hermes supports three connection modes. Configure via **Settings → Connection**.

### 1. Local Mode (Default)

```
Mode: local
```

- Agent runs on your machine
- Gateway spawns as a child process
- All data stored in `~/.hermes/` (or `HERMES_HOME`)
- No network configuration needed

### 2. Remote Mode

```
Mode: remote
Remote URL: http://your-server:8000
```

- Connect to a Hermes instance running on another machine
- The remote server runs the agent + gateway
- The desktop app is a thin client
- Useful for GPU servers, always-on machines, etc.

**Setup:**
1. On the remote machine: install and start Hermes with the API server enabled
2. In Hermes desktop: **Settings → Connection → Remote**
3. Enter the remote URL (e.g., `http://192.168.1.100:8000`)
4. The app connects and proxies all requests

### 3. SSH Tunnel Mode

```
Mode: ssh
SSH Host: user@remote-host
SSH Port: 22
```

- SSH into a remote machine and tunnel the gateway connection
- Provides encryption and authentication via SSH keys
- Best for accessing remote servers through firewalls

**Setup:**
1. Ensure SSH key access to the remote machine
2. In Hermes desktop: **Settings → Connection → SSH**
3. Enter SSH host, port, and credentials
4. The app creates a tunnel and connects the gateway through it

---

## Troubleshooting

### Common Issues & Fixes

| Problem | Platform | Solution |
|---------|----------|----------|
| "App is damaged and can't be opened" | macOS | `xattr -cr /Applications/Hermes\ Mission\ Control.app` |
| SmartScreen warning on launch | Windows | Click **"More info"** → **"Run anyway"** |
| AppImage won't launch | Linux | `chmod +x Hermes*.AppImage` |
| SUID sandbox error on Linux | Debian/RPM | The `.deb`/`.rpm` packages auto-fix this; for AppImage: `sudo chmod 4755 chrome-sandbox` |
| Native module errors after install | All | `npm run postinstall` to rebuild native deps |
| `better-sqlite3` build failure | All | `npm run rebuild:native` |
| Gateway won't start | All | Check Python venv exists: `ls ~/.hermes/hermes-agent/venv/` |
| Gateway still not starting | All | Check `~/.hermes/gateway_state.json` for port conflicts |
| "Hermes is not installed" | All | Re-run install: the app will prompt on next launch |
| Python not found during install | All | Ensure Python 3.11+ is installed, or let `uv` install it |
| Port conflict | All | Check `~/.hermes/gateway_state.json` → change gateway port |
| Stale gateway process | All | Check `~/.hermes/gateway.pid` → kill the process manually |
| Provider key not recognized | All | Verify env var name matches the provider table above |
| OAuth sign-in fails | All | Check `~/.hermes/auth.json` exists and is writable |
| OpenClaw migration needed | All | Hermes detects `~/.openclaw`, `~/.clawdbot`, or `~/.moldbot` and offers migration |

### Diagnostic Commands

```bash
# Run Hermes doctor (comprehensive health check)
~/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main doctor

# Check Hermes version
~/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main --version

# Verify Python venv
~/.hermes/hermes-agent/venv/bin/python --version

# Check if gateway process is running
cat ~/.hermes/gateway.pid  # Then: ps -p <PID>

# View gateway state
cat ~/.hermes/gateway_state.json

# Check active profile
cat ~/.hermes/active_profile
```

### Windows-Specific Paths

On Windows, the equivalent commands use:

```powershell
# Python in venv
%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\pythonw.exe

# Hermes CLI
%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\hermes.exe

# Or from ~/.hermes (if that's HERMES_HOME)
%USERPROFILE%\.hermes\hermes-agent\venv\Scripts\pythonw.exe
```

### Reinstall from Scratch

```bash
# macOS / Linux
rm -rf ~/.hermes/hermes-agent
# Re-launch the app — it will re-trigger the installer

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\hermes\hermes-agent"
# Re-launch the app
```

> ⚠️ This only removes the runtime. Your config, keys, sessions, and profiles in `~/.hermes/` are preserved.

---

## Environment Variables Reference

### LLM Provider Keys

| Variable                | Provider           | Required For         |
|-------------------------|--------------------|----------------------|
| `OPENROUTER_API_KEY`    | OpenRouter         | openrouter provider  |
| `ANTHROPIC_API_KEY`     | Anthropic          | anthropic provider   |
| `OPENAI_API_KEY`        | OpenAI             | openai provider      |
| `GOOGLE_API_KEY`        | Google AI Studio   | google provider      |
| `GEMINI_API_KEY`        | Google Gemini      | gemini provider      |
| `HERMES_GEMINI_PROJECT_ID` | Google Gemini   | Vertex AI project    |
| `XAI_API_KEY`           | xAI (Grok)         | xai provider         |
| `DEEPSEEK_API_KEY`      | DeepSeek           | deepseek provider    |
| `GROQ_API_KEY`          | Groq               | groq provider        |
| `TOGETHER_API_KEY`      | Together AI        | together provider    |
| `FIREWORKS_API_KEY`     | Fireworks AI       | fireworks provider   |
| `CEREBRAS_API_KEY`      | Cerebras           | cerebras provider    |
| `MISTRAL_API_KEY`       | Mistral            | mistral provider     |
| `PERPLEXITY_API_KEY`    | Perplexity         | perplexity provider  |
| `HF_TOKEN`              | Hugging Face       | huggingface provider |
| `OLLAMA_API_KEY`        | Ollama Cloud       | ollama-cloud provider|
| `NVIDIA_API_KEY`        | NVIDIA NIM         | nvidia provider      |
| `NOUS_API_KEY`          | Nous Research      | nous provider        |
| `XIAOMI_API_KEY`        | Xiaomi MiMo        | xiaomi provider      |
| `GLM_API_KEY`           | Z.ai / GLM         | glm provider         |
| `KIMI_API_KEY`          | Kimi               | kimi provider        |
| `MINIMAX_API_KEY`       | MiniMax            | minimax provider     |
| `MINIMAX_CN_API_KEY`    | MiniMax (China)    | minimax-cn provider  |
| `QWEN_API_KEY`          | Qwen               | qwen provider        |
| `CUSTOM_API_KEY`        | Any custom endpoint| Fallback for unrecognized URLs |

### Tool & Service API Keys

| Variable               | Service            | Purpose                        |
|------------------------|--------------------|--------------------------------|
| `EXA_API_KEY`          | Exa                | Web search                     |
| `PARALLEL_API_KEY`     | Parallel           | Web search                     |
| `TAVILY_API_KEY`       | Tavily             | Web search                     |
| `FIRECRAWL_API_KEY`    | Firecrawl          | Web scraping                   |
| `FAL_KEY`              | Fal.ai             | Image generation               |
| `HONCHO_API_KEY`       | Honcho             | Memory/context management      |
| `NOTION_API_KEY`       | Notion             | Notion tickets integration     |
| `WANDB_API_KEY`        | Weights & Biases   | Experiment tracking            |
| `TINKER_API_KEY`       | Tinker             | Research/training              |

### Browser Automation

| Variable                   | Service       | Purpose               |
|----------------------------|---------------|------------------------|
| `BROWSERBASE_API_KEY`      | Browserbase   | Cloud browser sessions |
| `BROWSERBASE_PROJECT_ID`   | Browserbase   | Project identification |

### Voice / STT

| Variable                  | Service       | Purpose               |
|---------------------------|---------------|------------------------|
| `VOICE_TOOLS_OPENAI_KEY`  | OpenAI        | Speech-to-text         |

### Gateway / Messaging Platform Variables

| Variable                  | Platform       | Required |
|---------------------------|----------------|----------|
| `TELEGRAM_BOT_TOKEN`      | Telegram       | ✅       |
| `TELEGRAM_ALLOWED_USERS`  | Telegram       | ❌       |
| `TELEGRAM_PROXY`          | Telegram       | ❌       |
| `DISCORD_BOT_TOKEN`       | Discord        | ✅       |
| `DISCORD_ALLOWED_USERS`   | Discord        | ❌       |
| `DISCORD_ALLOWED_CHANNELS`| Discord        | ❌       |
| `DISCORD_REPLY_TO_MODE`   | Discord        | ❌       |
| `SLACK_BOT_TOKEN`         | Slack          | ✅       |
| `SLACK_APP_TOKEN`         | Slack          | ✅       |
| `MATTERMOST_URL`          | Mattermost     | ✅       |
| `MATTERMOST_TOKEN`        | Mattermost     | ✅       |
| `MATTERMOST_ALLOWED_USERS`| Mattermost    | ❌       |
| `MATRIX_HOMESERVER`       | Matrix         | ✅       |
| `MATRIX_ACCESS_TOKEN`     | Matrix         | ✅       |
| `MATRIX_USER_ID`          | Matrix         | ✅       |
| `MATRIX_ALLOWED_USERS`    | Matrix         | ❌       |
| `SIGNAL_HTTP_URL`         | Signal         | ✅       |
| `SIGNAL_ACCOUNT`          | Signal         | ✅       |
| `SIGNAL_ALLOWED_USERS`    | Signal         | ❌       |
| `WHATSAPP_ALLOWED_USERS`  | WhatsApp       | ❌       |
| `BLUEBUBBLES_SERVER_URL`  | iMessage       | ✅       |
| `BLUEBUBBLES_PASSWORD`    | iMessage       | ✅       |
| `BLUEBUBBLES_ALLOWED_USERS`| iMessage      | ❌       |
| `HASS_URL`                | Home Assistant | ✅       |
| `HASS_TOKEN`              | Home Assistant | ✅       |
| `EMAIL_ADDRESS`           | Email          | ✅       |
| `EMAIL_PASSWORD`          | Email          | ✅       |
| `EMAIL_IMAP_HOST`         | Email          | ✅       |
| `EMAIL_SMTP_HOST`         | Email          | ✅       |
| `TWILIO_ACCOUNT_SID`      | SMS (Twilio)   | ✅       |
| `TWILIO_AUTH_TOKEN`       | SMS (Twilio)   | ✅       |
| `TWILIO_PHONE_NUMBER`     | SMS (Twilio)   | ❌       |
| `DINGTALK_CLIENT_ID`      | DingTalk       | ✅       |
| `DINGTALK_CLIENT_SECRET`  | DingTalk       | ✅       |
| `FEISHU_APP_ID`           | Feishu / Lark  | ✅       |
| `FEISHU_APP_SECRET`       | Feishu / Lark  | ✅       |
| `FEISHU_ENCRYPT_KEY`      | Feishu / Lark  | ❌       |
| `FEISHU_VERIFICATION_TOKEN`| Feishu / Lark | ❌       |
| `WECOM_BOT_ID`            | WeCom (bot)    | ✅       |
| `WECOM_SECRET`            | WeCom (bot)    | ❌       |
| `WECOM_CALLBACK_CORP_ID`  | WeCom (app)    | ✅       |
| `WECOM_CALLBACK_CORP_SECRET`| WeCom (app)  | ✅       |
| `WECOM_CALLBACK_AGENT_ID` | WeCom (app)    | ✅       |
| `WECOM_CALLBACK_TOKEN`    | WeCom (app)    | ❌       |
| `WECOM_CALLBACK_ENCODING_AES_KEY`| WeCom (app)| ❌     |
| `WEIXIN_ACCOUNT_ID`       | WeChat         | ✅       |
| `WEIXIN_TOKEN`            | WeChat         | ✅       |
| `WEIXIN_BASE_URL`         | WeChat         | ❌       |
| `QQ_APP_ID`               | QQ Bot         | ✅       |
| `QQ_CLIENT_SECRET`        | QQ Bot         | ✅       |
| `QQ_ALLOWED_USERS`        | QQ Bot         | ❌       |
| `API_SERVER_ENABLED`      | API Server     | ❌       |
| `API_SERVER_KEY`          | API Server     | ❌       |
| `API_SERVER_PORT`         | API Server     | ❌       |
| `API_SERVER_HOST`         | API Server     | ❌       |
| `API_SERVER_MODEL_NAME`   | API Server     | ❌       |
| `WEBHOOK_ENABLED`         | Webhooks       | ❌       |
| `WEBHOOK_PORT`            | Webhooks       | ❌       |
| `WEBHOOK_SECRET`          | Webhooks       | ❌       |

---

## File & Directory Reference

### Key Paths

| Path                                         | Description                          |
|----------------------------------------------|--------------------------------------|
| `~/.hermes/`                                 | HERMES_HOME (macOS/Linux default)    |
| `%LOCALAPPDATA%\hermes\`                     | HERMES_HOME (Windows default)        |
| `~/.hermes/hermes-agent/`                    | Hermes Agent runtime (git repo)      |
| `~/.hermes/hermes-agent/venv/`               | Python virtual environment           |
| `~/.hermes/hermes-agent/venv/bin/python`     | Python binary (macOS/Linux)          |
| `~/.hermes/hermes-agent/venv/Scripts/pythonw.exe` | Python binary (Windows)         |
| `~/.hermes/config.yaml`                      | Default profile configuration        |
| `~/.hermes/.env`                             | Default profile environment vars     |
| `~/.hermes/auth.json`                        | Default profile OAuth credentials    |
| `~/.hermes/active_profile`                   | Current active profile name          |
| `~/.hermes/profiles/<name>/`                 | Named profile directory              |
| `~/.hermes/profiles/<name>/config.yaml`      | Named profile config                 |
| `~/.hermes/profiles/<name>/.env`             | Named profile env vars               |
| `~/.hermes/gateway.pid`                      | Running gateway process ID           |
| `~/.hermes/gateway_state.json`               | Gateway runtime state & port info    |
| `<userData>/hermes-home.json`                | Custom HERMES_HOME override          |

### config.yaml Structure

```yaml
# Model configuration
model:
  default: "anthropic/claude-sonnet-4-20250514"
  provider: openrouter
  base_url: "https://openrouter.ai/api/v1"

# Profile metadata
role: general
team: ""
description: "My main Hermes profile"

# MCP servers
mcp:
  servers:
    my-server:
      type: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
      env: {}

# Worker pool (for director profiles)
WORKER_POOL_PATH: ""
```

---

## Quick Reference — Complete Setup Checklist

```
□ Install Node.js 22+ and Python 3.11+
□ Install platform-specific build tools
□ Download release OR build from source
□ Launch app → auto-installs hermes-agent
□ Select AI provider → enter API key
□ (Optional) Configure gateway platforms
□ (Optional) Add MCP servers
□ (Optional) Create additional profiles
□ (Optional) Set up Notion integration
□ (Optional) Configure connection mode (local/remote/SSH)
```

---

> **Document version:** Generated from hermes-desktop v2.0.0 source code.
> **App ID:** `com.indigoint.hermes-mission-control`
> **Publisher:** [fathah/hermes-desktop](https://github.com/fathah/hermes-desktop)
> **Vendor:** Nous Research
