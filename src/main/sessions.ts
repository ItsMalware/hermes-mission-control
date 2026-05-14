import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { profileHome } from "./utils";

export interface SessionSummary {
  id: string;
  source: string;
  startedAt: number;
  endedAt: number | null;
  messageCount: number;
  model: string;
  title: string | null;
  preview: string;
}

export interface SessionMessage {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
}

export interface SearchResult {
  sessionId: string;
  title: string | null;
  startedAt: number;
  source: string;
  messageCount: number;
  model: string;
  snippet: string;
}

function dbPath(profile?: string): string {
  return join(profileHome(profile), "state.db");
}

function sessionsDir(profile?: string): string {
  return join(profileHome(profile), "sessions");
}

function getDb(profile?: string): Database.Database | null {
  const DB_PATH = dbPath(profile);
  if (!existsSync(DB_PATH)) return null;
  return new Database(DB_PATH, { readonly: true });
}

export function listSessions(
  limit = 30,
  offset = 0,
  profile?: string,
): SessionSummary[] {
  const db = getDb(profile);
  if (!db) return [];

  try {
    // Simple query without correlated subquery — titles come from session cache
    const rows = db
      .prepare(
        `SELECT
          s.id,
          s.source,
          s.started_at,
          s.ended_at,
          s.message_count,
          s.model,
          s.title
        FROM sessions s
        ORDER BY s.started_at DESC
        LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Array<{
      id: string;
      source: string;
      started_at: number;
      ended_at: number | null;
      message_count: number;
      model: string;
      title: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      messageCount: r.message_count,
      model: r.model || "",
      title: r.title,
      preview: "",
    }));
  } finally {
    db.close();
  }
}

export function searchSessions(
  query: string,
  limit = 20,
  profile?: string,
): SearchResult[] {
  const db = getDb(profile);
  if (!db) return [];

  try {
    // Check if FTS table exists
    const tableCheck = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'",
      )
      .get() as { name: string } | undefined;

    if (!tableCheck) return [];

    // Sanitize query for FTS5: wrap each word with quotes for safety, add * for prefix
    const sanitized = query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => `"${w.replace(/"/g, "")}"*`)
      .join(" ");

    if (!sanitized) return [];

    const rows = db
      .prepare(
        `SELECT DISTINCT
          m.session_id,
          s.title,
          s.started_at,
          s.source,
          s.message_count,
          s.model,
          snippet(messages_fts, 0, '<<', '>>', '...', 40) as snippet
        FROM messages_fts
        JOIN messages m ON m.id = messages_fts.rowid
        JOIN sessions s ON s.id = m.session_id
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT ?`,
      )
      .all(sanitized, limit) as Array<{
      session_id: string;
      title: string | null;
      started_at: number;
      source: string;
      message_count: number;
      model: string;
      snippet: string;
    }>;

    return rows.map((r) => ({
      sessionId: r.session_id,
      title: r.title,
      startedAt: r.started_at,
      source: r.source,
      messageCount: r.message_count,
      model: r.model || "",
      snippet: r.snippet || "",
    }));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export function getSessionMessages(
  sessionId: string,
  profile?: string,
): SessionMessage[] {
  const db = getDb(profile);
  if (!db) return getFileSessionMessages(sessionId, profile);

  try {
    const rows = db
      .prepare(
        `SELECT id, role, content, timestamp
         FROM messages
         WHERE session_id = ? AND role IN ('user', 'assistant') AND content IS NOT NULL
         ORDER BY timestamp, id`,
      )
      .all(sessionId) as Array<{
      id: number;
      role: string;
      content: string;
      timestamp: number;
    }>;

    const messages = rows.map((r) => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      content: r.content,
      timestamp: r.timestamp,
    }));
    return messages.length > 0
      ? messages
      : getFileSessionMessages(sessionId, profile);
  } finally {
    db.close();
  }
}

function getFileSessionMessages(
  sessionId: string,
  profile?: string,
): SessionMessage[] {
  const SESSIONS_DIR = sessionsDir(profile);
  const file = join(SESSIONS_DIR, `session_${sessionId}.json`);
  if (!existsSync(file)) return [];

  try {
    const payload = JSON.parse(readFileSync(file, "utf-8"));
    const startedAt = Math.floor(Date.parse(payload.session_start || "") / 1000);
    const baseTimestamp = Number.isFinite(startedAt) ? startedAt : 0;
    const rows = Array.isArray(payload.messages) ? payload.messages : [];
    return rows
      .map((m, index) => ({
        id: index + 1,
        role: m?.role,
        content: typeof m?.content === "string" ? m.content : "",
        timestamp: baseTimestamp + index,
      }))
      .filter(
        (m): m is SessionMessage =>
          (m.role === "user" || m.role === "assistant") && m.content.length > 0,
      );
  } catch {
    return [];
  }
}
