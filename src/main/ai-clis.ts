import { execFile } from "child_process";
import { promisify } from "util";
import { getEnhancedPath } from "./installer";

const execFileAsync = promisify(execFile);

export interface AiCliInfo {
  id: string;
  name: string;
  command: string;
  installed: boolean;
  path: string | null;
  version: string | null;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  description: string;
  error?: string;
}

interface CliDefinition {
  id: string;
  name: string;
  command: string;
  versionArgs: string[];
  description: string;
}

const AI_CLIS: CliDefinition[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    versionArgs: ["--version"],
    description: "Anthropic's coding agent CLI.",
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    command: "hermes",
    versionArgs: ["--version"],
    description: "Nous Research's local agent runtime.",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    versionArgs: ["--version"],
    description: "Google's command-line AI assistant.",
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
  },
  {
    id: "free-claude-code",
    name: "Free Claude Code",
    command: "fcc-server",
    versionArgs: ["--version"],
    description: "OpenRouter-compatible Claude Code wrapper.",
  },
];

function cleanOutput(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "").trim();
}

async function commandPath(command: string): Promise<string | null> {
  const shell = process.platform === "win32" ? "where" : "/bin/sh";
  const args =
    process.platform === "win32" ? [command] : ["-lc", `command -v ${command}`];
  try {
    const { stdout } = await execFileAsync(shell, args, {
      env: { ...process.env, PATH: getEnhancedPath() },
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
      env: { ...process.env, PATH: getEnhancedPath() },
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
      const path = await commandPath(cli.command);
      if (!path) {
        return {
          ...cli,
          installed: false,
          path: null,
          version: null,
          status: "OFFLINE" as const,
        };
      }

      const version = await commandVersion(cli.command, cli.versionArgs);
      return {
        ...cli,
        installed: true,
        path,
        version: version.version,
        status: version.error ? ("DEGRADED" as const) : ("ONLINE" as const),
        error: version.error,
      };
    }),
  );
}
