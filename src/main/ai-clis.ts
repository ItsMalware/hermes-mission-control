import { execFile } from "child_process";
import { mkdirSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { getEnhancedPath, HERMES_HOME } from "./installer";

const execFileAsync = promisify(execFile);

export interface AiCliRunResult {
  id: string;
  command: string;
  args: string[];
  output: string;
  exitCode: number | null;
  success: boolean;
  error?: string;
}

export interface AiCliInfo {
  id: string;
  name: string;
  command: string;
  installed: boolean;
  path: string | null;
  version: string | null;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  description: string;
  promptMode: boolean;
  error?: string;
}

interface CliDefinition {
  id: string;
  name: string;
  command: string;
  versionArgs: string[];
  description: string;
  promptArgs?: (prompt: string) => string[];
}

const AI_CLIS: CliDefinition[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    versionArgs: ["--version"],
    description: "Anthropic's coding agent CLI.",
    promptArgs: (prompt) => ["-p", prompt],
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    command: "hermes",
    versionArgs: ["--version"],
    description: "Nous Research's local agent runtime.",
    promptArgs: (prompt) => ["chat", "-q", prompt, "-Q", "--source", "desktop-ai-clis"],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    versionArgs: ["--version"],
    description: "Google's command-line AI assistant.",
    promptArgs: (prompt) => ["-p", prompt],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    command: "agy",
    versionArgs: ["--version"],
    description: "Google's agentic CLI harness.",
  },
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    versionArgs: ["--version"],
    description: "OpenAI's coding agent CLI.",
    promptArgs: (prompt) => ["exec", prompt],
  },
  {
    id: "free-claude-code",
    name: "Free Claude Code",
    command: "fcc-server",
    versionArgs: ["--version"],
    description: "OpenRouter-compatible Claude Code wrapper.",
  },
];

function findCli(id: string): CliDefinition {
  const cli = AI_CLIS.find((item) => item.id === id);
  if (!cli) throw new Error("Unknown AI CLI.");
  return cli;
}

function cleanOutput(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "").trim();
}

function aiCliEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: getEnhancedPath(),
    TERM: process.env.TERM || "xterm-256color",
    COLORTERM: process.env.COLORTERM || "truecolor",
  };
}

function aiCliCwd(id: string): string {
  const dir = join(HERMES_HOME, "ai-cli-workspaces", id);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function commandPath(command: string): Promise<string | null> {
  const shell = process.platform === "win32" ? "where" : "/bin/sh";
  const args =
    process.platform === "win32" ? [command] : ["-lc", `command -v ${command}`];
  try {
    const { stdout } = await execFileAsync(shell, args, {
      env: aiCliEnv(),
      timeout: 3000,
      windowsHide: true,
    });
    return cleanOutput(stdout).split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

async function commandVersion(
  command: string,
  args: string[],
): Promise<{ version: string | null; error?: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      env: aiCliEnv(),
      timeout: 5000,
      windowsHide: true,
    });
    const output = cleanOutput(stdout || stderr);
    return { version: output.split(/\r?\n/)[0] || null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { version: null, error: message };
  }
}

export async function listAiClis(): Promise<AiCliInfo[]> {
  return Promise.all(
    AI_CLIS.map(async (cli) => {
      const { promptArgs: _promptArgs, ...publicCli } = cli;
      const path = await commandPath(cli.command);
      if (!path) {
        return {
          ...publicCli,
          installed: false,
          path: null,
          version: null,
          status: "OFFLINE" as const,
          promptMode: Boolean(cli.promptArgs),
      };
    }

      const version = await commandVersion(cli.command, cli.versionArgs);
      return {
        ...publicCli,
        installed: true,
        path,
        version: version.version,
        status: version.error ? ("DEGRADED" as const) : ("ONLINE" as const),
        promptMode: Boolean(cli.promptArgs),
        error: version.error,
      };
    }),
  );
}

export async function runAiCliPrompt(
  id: string,
  prompt: string,
): Promise<AiCliRunResult> {
  const cli = findCli(id);
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Prompt is required.");
  if (!cli.promptArgs) {
    throw new Error(`${cli.name} does not have a known one-shot prompt mode yet.`);
  }

  const path = await commandPath(cli.command);
  if (!path) throw new Error(`${cli.name} is not installed or is not on PATH.`);

  const args = cli.promptArgs(trimmed);
  try {
    const { stdout, stderr } = await execFileAsync(cli.command, args, {
      cwd: aiCliCwd(id),
      env: aiCliEnv(),
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 3,
      windowsHide: true,
    });
    const output = cleanOutput([stdout, stderr].filter(Boolean).join("\n"));
    return {
      id,
      command: cli.command,
      args,
      output: output || "(no output)",
      exitCode: 0,
      success: true,
    };
  } catch (err) {
    const maybe = err as {
      stdout?: string;
      stderr?: string;
      code?: number | null;
      message?: string;
    };
    const output = cleanOutput(
      [maybe.stdout, maybe.stderr, maybe.message].filter(Boolean).join("\n"),
    );
    return {
      id,
      command: cli.command,
      args,
      output: output || "Command failed without output.",
      exitCode: typeof maybe.code === "number" ? maybe.code : null,
      success: false,
      error: maybe.message || "Command failed.",
    };
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function openAiCliTerminal(id: string): Promise<boolean> {
  const cli = findCli(id);
  const path = await commandPath(cli.command);
  if (!path) throw new Error(`${cli.name} is not installed or is not on PATH.`);

  if (process.platform === "darwin") {
    const cwd = aiCliCwd(id);
    const script = [
      "tell application \"Terminal\"",
      "activate",
      `do script ${JSON.stringify(`cd ${shellQuote(cwd)}; export TERM=xterm-256color; export COLORTERM=truecolor; ${shellQuote(path)}`)}`,
      "end tell",
    ].join("\n");
    await execFileAsync("osascript", ["-e", script], {
      timeout: 5000,
      windowsHide: true,
    });
    return true;
  }

  if (process.platform === "win32") {
    await execFileAsync("cmd.exe", ["/c", "start", "cmd.exe", "/k", path], {
      cwd: aiCliCwd(id),
      timeout: 5000,
      windowsHide: true,
    });
    return true;
  }

  await execFileAsync(
    "/bin/sh",
    [
      "-lc",
      `cd ${shellQuote(aiCliCwd(id))}; TERM=xterm-256color COLORTERM=truecolor x-terminal-emulator -e ${shellQuote(path)} &`,
    ],
    {
      timeout: 5000,
      windowsHide: true,
    },
  );
  return true;
}
