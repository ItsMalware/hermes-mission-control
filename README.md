<p align="center">
  <h1 align="center">Hermes Mission Control</h1>
  <p align="center">
    <strong>Your Personal AI Operating System</strong>
  </p>
  <p align="center">
    <a href="https://github.com/ItsMalware/hermes-mission-control/stargazers"><img src="https://img.shields.io/github/stars/ItsMalware/hermes-mission-control?style=flat&color=5D5CDE" alt="Stars"></a>
    <a href="https://github.com/ItsMalware/hermes-mission-control/releases"><img src="https://img.shields.io/github/downloads/ItsMalware/hermes-mission-control/total?style=flat&color=44CC11" alt="Downloads"></a>
    <a href="https://github.com/ItsMalware/hermes-mission-control/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ItsMalware/hermes-mission-control?style=flat&color=blue" alt="License"></a>
    <img src="https://img.shields.io/badge/version-2.0.0-orange?style=flat" alt="Version">
  </p>
</p>

---

Hermes Mission Control is a cross-platform desktop application that wraps the Hermes Agent CLI in a native experience — giving you multi-provider AI chat, 19 messaging gateways, persistent memory, an interactive 3D office, and a growing ecosystem of tools and integrations. Built with Electron, React, and TypeScript. All data stays local.

Built by **Indigo Intelligence**.

---

## Quick Start

1. **Download** — Grab the latest release for your platform from [Releases](https://github.com/ItsMalware/hermes-mission-control/releases).
2. **Install** — Run the installer (`.dmg` for macOS, `.exe` for Windows, `.AppImage`/`.deb`/`.rpm`/`.snap` for Linux).
3. **Launch** — Open Hermes Mission Control, configure your first provider, and start chatting.

---

## Features

### 🤖 Multi-Provider AI Chat

Connect to **35+ providers** including OpenRouter, Anthropic, OpenAI, Google, xAI, DeepSeek, Groq, and local models via Ollama or vLLM. Full support for streaming responses, tool use, reasoning display, and image/audio attachments.

### 📱 19 Messaging Gateways

Reach your agent from anywhere — Telegram, Discord, Slack, WhatsApp, Signal, iMessage (BlueBubbles), Email, SMS (Twilio), Matrix, Mattermost, DingTalk, Feishu/Lark, WeCom, WeChat, QQ Bot, Home Assistant, API Server, and Webhooks.

### 🧠 Memory & Learning

Persistent memory powered by `MEMORY.md` and user profiling via `USER.md`. Integrates with Obsidian vaults for notes, journaling, and daily review — your agent remembers context across sessions.

### 🏢 3D Office

An interactive Three.js-powered office environment where AI agent profiles appear as team members. Assign a CEO, build your AI team, and manage agents visually.

### 🔧 MCP Ecosystem

Connect MCP servers to extend your agent's tool capabilities. Browse a built-in marketplace to discover servers, skills, and workflows.

### 📋 Notion Integration

Query Notion databases directly from the app for ticket tracking and project management workflows.

### 📝 SEO Pipeline

Generate SEO-optimized articles from transcripts and deploy them to connected sites — content creation powered by your AI agent.

### 📓 NotebookLM

NotebookLM integration via MCP for research workflows and studio artifacts.

### 🖥️ AI CLIs

Launch Claude Code, Gemini CLI, Antigravity, Codex, OpenCode, and Hermes Agent directly from the app's built-in terminal.

### 🔒 Local-First

All data is stored locally in `~/.hermes`. Your API keys, conversation history, memory files, and configuration never leave your machine. Your keys, your data, your control.

### 🌍 10 Languages

Full localization support: English, Spanish, Indonesian, Japanese, Polish, Portuguese (BR/PT), Turkish, and Chinese (Simplified/Traditional).

### 🖥️ Cross-Platform

Native builds for **macOS**, **Windows**, and **Linux** (AppImage, snap, deb, rpm).

---

## Building from Source

```bash
git clone https://github.com/ItsMalware/hermes-mission-control.git
cd hermes-desktop
npm install
```

| Command              | Description          |
| -------------------- | -------------------- |
| `npm run dev`        | Development mode     |
| `npm run build:mac`  | Build for macOS      |
| `npm run build:win`  | Build for Windows    |
| `npm run build:linux`| Build for Linux      |

---

## Tech Stack

| Layer      | Technology              |
| ---------- | ----------------------- |
| Runtime    | Electron 39             |
| Frontend   | React 19                |
| Language   | TypeScript 5.9          |
| Bundler    | Vite 7                  |
| 3D Engine  | Three.js                |

---

## Agent Setup

If you're an AI agent helping a user set up this app, see **[AGENT_SETUP.md](./AGENT_SETUP.md)** for comprehensive platform-specific instructions covering installation, provider configuration, gateway setup, and troubleshooting.

---

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository.
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit** your changes with clear, descriptive messages.
4. **Push** to your fork and open a **Pull Request** against `main`.

Please keep PRs focused — one feature or fix per PR. For larger changes, open an issue first to discuss the approach.

---

## Acknowledgments

Originally forked from [NousResearch/hermes-desktop](https://github.com/NousResearch/hermes-desktop). This project has since evolved significantly with new features, integrations, and a different product direction.

---

## License

This project is licensed under the [MIT License](./LICENSE).
