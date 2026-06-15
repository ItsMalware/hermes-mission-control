import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { profileHome } from "./utils";

export interface SessionTodo {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | string;
}

export interface SessionTodoState {
  sessionId: string;
  updatedAt: number;
  todos: SessionTodo[];
  summary: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
}

function sessionsDir(profile?: string): string {
  return join(profileHome(profile), "sessions");
}

function parseTodoContent(content: string): Pick<SessionTodoState, "todos" | "summary"> | null {
  try {
    const parsed = JSON.parse(content) as Partial<SessionTodoState>;
    if (!Array.isArray(parsed.todos)) return null;
    const todos = parsed.todos
      .filter(
        (todo): todo is SessionTodo =>
          typeof todo?.id === "string" &&
          typeof todo?.content === "string" &&
          typeof todo?.status === "string",
      );
    if (todos.length === 0) return null;
    const summary = parsed.summary || {
      total: todos.length,
      pending: todos.filter((todo) => todo.status === "pending").length,
      in_progress: todos.filter((todo) => todo.status === "in_progress").length,
      completed: todos.filter((todo) => todo.status === "completed").length,
      cancelled: todos.filter((todo) => todo.status === "cancelled").length,
    };
    return {
      todos,
      summary: {
        total: Number(summary.total || todos.length),
        pending: Number(summary.pending || 0),
        in_progress: Number(summary.in_progress || 0),
        completed: Number(summary.completed || 0),
        cancelled: Number(summary.cancelled || 0),
      },
    };
  } catch {
    return null;
  }
}

export function getSessionTodoState(profile?: string): SessionTodoState | null {
  const dir = sessionsDir(profile);
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir)
    .filter((file) => file.startsWith("session_") && file.endsWith(".json"))
    .map((file) => {
      const path = join(dir, file);
      return { file, path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const entry of files) {
    try {
      const payload = JSON.parse(readFileSync(entry.path, "utf-8"));
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role !== "tool" || typeof message.content !== "string") {
          continue;
        }
        const state = parseTodoContent(message.content);
        if (!state) continue;
        const startedAt = Date.parse(
          payload.last_updated || payload.session_start || "",
        );
        return {
          sessionId: String(payload.session_id || entry.file.slice(8, -5)),
          updatedAt: Number.isFinite(startedAt)
            ? Math.floor(startedAt / 1000)
            : Math.floor(entry.mtimeMs / 1000),
          ...state,
        };
      }
    } catch {
      // Ignore malformed legacy transcript files.
    }
  }

  return null;
}
