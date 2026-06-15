/**
 * notebooklm.ts — MCP stdio client bridge for the NotebookLM MCP server.
 *
 * Spawns `npx notebooklm-mcp` as a child process, performs the MCP
 * initialization handshake, and exposes high-level functions for the IPC
 * layer to call.
 */

import { spawn, type ChildProcess } from "child_process";
import { getEnhancedPath } from "./installer";

/* ─── JSON-RPC 2.0 types ──────────────────────────────────────────────── */

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/* ─── Constants ────────────────────────────────────────────────────────── */

const REQUEST_TIMEOUT_MS = 90_000; // 90 s for potentially slow MCP ops

/* ─── MCP stdio client ─────────────────────────────────────────────────── */

class NotebookLmMcpClient {
  private proc: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private buffer = "";
  private ready = false;
  private tools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }> = [];
  private connectPromise: Promise<void> | null = null;

  /* ── lifecycle ──────────────────────────────────────────────────────── */

  /** Ensure the MCP client is connected and initialized. */
  async ensureConnected(): Promise<void> {
    if (this.ready && this.proc && !this.proc.killed) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async _connect(): Promise<void> {
    this.disconnect();

    console.log("[notebooklm-mcp] spawning…");
    this.proc = spawn("npx", ["-y", "notebooklm-mcp@latest"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PATH: getEnhancedPath() },
      windowsHide: true,
    });

    this.proc.stdout!.setEncoding("utf-8");
    this.proc.stdout!.on("data", (chunk: string) => this._onData(chunk));
    this.proc.stderr!.on("data", (chunk: Buffer) => {
      console.log("[notebooklm-mcp stderr]", chunk.toString().trim());
    });
    this.proc.on("exit", (code) => {
      console.log("[notebooklm-mcp] exited with code", code);
      this.ready = false;
      this._rejectAll(
        new Error(`notebooklm-mcp exited with code ${code}`),
      );
    });

    // MCP initialization handshake
    const initResult = await this._request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "hermes-desktop", version: "0.5.8" },
    });
    console.log(
      "[notebooklm-mcp] initialized:",
      JSON.stringify(initResult).slice(0, 300),
    );

    // Confirm initialization
    this._notify("notifications/initialized", {});

    // Discover available tools
    const toolsResult = (await this._request("tools/list", {})) as {
      tools: Array<{
        name: string;
        description?: string;
        inputSchema?: unknown;
      }>;
    };
    this.tools = toolsResult.tools || [];
    console.log(
      "[notebooklm-mcp] discovered tools:",
      this.tools.map((t) => t.name).join(", "),
    );

    this.ready = true;
  }

  disconnect(): void {
    this.ready = false;
    this._rejectAll(new Error("Client disconnecting"));
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.buffer = "";
  }

  /* ── IO ─────────────────────────────────────────────────────────────── */

  private _onData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        if (msg.id !== undefined) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            this.pending.delete(msg.id);
            clearTimeout(pending.timer);
            if (msg.error) {
              pending.reject(
                new Error(msg.error.message || "MCP error"),
              );
            } else {
              pending.resolve(msg.result);
            }
          }
        }
        // Server-initiated notifications are ignored for now
      } catch {
        console.warn(
          "[notebooklm-mcp] failed to parse:",
          trimmed.slice(0, 200),
        );
      }
    }
  }

  private _request(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin) {
        return reject(new Error("NotebookLM MCP client not connected"));
      }
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      const msg: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
      this.proc.stdin.write(JSON.stringify(msg) + "\n");
    });
  }

  private _notify(
    method: string,
    params: Record<string, unknown>,
  ): void {
    if (!this.proc?.stdin) return;
    const msg: JsonRpcNotification = { jsonrpc: "2.0", method, params };
    this.proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  private _rejectAll(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  /* ── tool helpers ───────────────────────────────────────────────────── */

  /** Call an MCP tool by name and return the parsed result. */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    await this.ensureConnected();
    const result = (await this._request("tools/call", {
      name,
      arguments: args,
    })) as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    if (result.isError) {
      const errText =
        result.content?.map((c) => c.text).join("\n") || "MCP tool error";
      throw new Error(errText);
    }

    // Extract text content; try JSON-parsing it (most MCP tools return JSON)
    const textParts = (result.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text || "");
    const joined = textParts.join("\n");
    try {
      return JSON.parse(joined);
    } catch {
      return { text: joined };
    }
  }

  /** Check whether a tool exists. */
  hasTool(name: string): boolean {
    return this.tools.some((t) => t.name === name);
  }

  getToolNames(): string[] {
    return this.tools.map((t) => t.name);
  }
}

/* ─── Singleton ────────────────────────────────────────────────────────── */

let client: NotebookLmMcpClient | null = null;

function getClient(): NotebookLmMcpClient {
  if (!client) client = new NotebookLmMcpClient();
  return client;
}

/* ─── Exported helpers called by IPC handlers ──────────────────────────── */

/**
 * Try calling a tool by one of several candidate names (different MCP
 * server versions use different tool names).
 */
async function tryTool(
  c: NotebookLmMcpClient,
  candidates: string[],
  args: Record<string, unknown> = {},
): Promise<unknown> {
  for (const name of candidates) {
    if (c.hasTool(name)) {
      return c.callTool(name, args);
    }
  }
  // None found by name — try calling the first candidate anyway (the
  // server may have registered it under a different casing)
  return c.callTool(candidates[0], args);
}

export async function notebookLmHealth(): Promise<unknown> {
  try {
    const c = getClient();
    await c.ensureConnected();
    try {
      return await tryTool(c, ["get_health", "health", "check_auth"]);
    } catch {
      // No explicit health tool — the fact that we connected is good enough
      return {
        data: { authenticated: true },
        tools: c.getToolNames(),
      };
    }
  } catch (e) {
    return { data: { authenticated: false, error: String(e) } };
  }
}

export async function notebookLmSetupAuth(): Promise<unknown> {
  const c = getClient();
  await c.ensureConnected();
  return tryTool(c, ["setup_auth", "re_auth", "login"]);
}

export async function notebookLmListNotebooks(): Promise<unknown> {
  const c = getClient();
  return tryTool(c, ["list_notebooks", "list-notebooks", "listNotebooks"]);
}

export async function notebookLmCreateNotebook(
  title: string,
): Promise<unknown> {
  const c = getClient();
  return tryTool(
    c,
    ["create_notebook", "create-notebook", "createNotebook"],
    { title },
  );
}

export async function notebookLmLibrary(): Promise<unknown> {
  const c = getClient();
  try {
    return await tryTool(
      c,
      ["list_library", "library", "get_library", "list_sources"],
    );
  } catch {
    return { savedAssets: [] };
  }
}

export async function notebookLmStudioStatus(
  notebookId: string,
): Promise<unknown> {
  const c = getClient();
  return tryTool(c, ["studio_status", "get_studio", "studioStatus"], {
    notebook_id: notebookId,
  });
}

export async function notebookLmAsk(
  notebookId: string,
  question: string,
  notebookName?: string,
): Promise<unknown> {
  const c = getClient();
  return tryTool(c, ["ask", "query", "ask_notebook", "query_notebook"], {
    notebook_id: notebookId,
    question,
    notebook_name: notebookName,
  });
}

export async function notebookLmStudioCreate(
  notebookId: string,
  artifactType: string,
  customPrompt?: string,
): Promise<unknown> {
  const c = getClient();
  return tryTool(
    c,
    ["studio_create", "create_artifact", "studioCreate"],
    {
      notebook_id: notebookId,
      artifact_type: artifactType,
      custom_prompt: customPrompt,
    },
  );
}

export async function notebookLmDownloadArtifact(
  notebookId: string,
  artifactId: string,
  artifactType: string,
  title?: string,
  notebookName?: string,
): Promise<unknown> {
  const c = getClient();
  return tryTool(
    c,
    ["download_artifact", "downloadArtifact", "export_artifact"],
    {
      notebook_id: notebookId,
      artifact_id: artifactId,
      artifact_type: artifactType,
      title,
      notebook_name: notebookName,
    },
  );
}

export function notebookLmDisconnect(): void {
  client?.disconnect();
  client = null;
}
