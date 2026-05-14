import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { profileHome, safeWriteFile } from "./utils";
import Database from "better-sqlite3";
import { t } from "../shared/i18n";
import { getAppLocale } from "./locale";

export interface CachedSession {
  id: string;
  title: string;
  startedAt: number;
  source: string;
  messageCount: number;
  model: string;
}

interface CacheData {
  sessions: CachedSession[];
  lastSync: number;
}

function cacheFile(profile?: string): string {
  return join(profileHome(profile), "desktop", "sessions.json");
}

function dbPath(profile?: string): string {
  return join(profileHome(profile), "state.db");
}

function sessionsDir(profile?: string): string {
  return join(profileHome(profile), "sessions");
}

// Generate a short, readable title from the first user message (like ChatGPT/Claude)
function generateTitle(message: string): string {
  if (!message || !message.trim())
    return t("sessions.newConversation", getAppLocale());

  // Clean up the message
  let text = message.trim();

  // Remove markdown formatting
  text = text.replace(/[#*_`~\[\]()]/g, "");
  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, "");
  // Remove extra whitespace
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return t("sessions.newConversation", getAppLocale());

  // If short enough, use as-is
  if (text.length <= 50) return text;

  // Take first meaningful chunk — aim for ~40-50 chars at word boundary
  const words = text.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + " " + word).trim().length > 45) break;
    title = (title + " " + word).trim();
  }

  return title || text.slice(0, 45) + "...";
}

function readCache(profile?: string): CacheData {
  try {
    const CACHE_FILE = cacheFile(profile);
    if (!existsSync(CACHE_FILE)) return { sessions: [], lastSync: 0 };
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return { sessions: [], lastSync: 0 };
  }
}

function writeCache(data: CacheData, profile?: string): void {
  try {
    safeWriteFile(cacheFile(profile), JSON.stringify(data));
  } catch {
    // non-fatal
  }
}

function getDb(profile?: string): Database.Database | null {
  const DB_PATH = dbPath(profile);
  if (!existsSync(DB_PATH)) return null;
  return new Database(DB_PATH, { readonly: true });
}

function readFileBackedSessions(
  dbIds: Set<string>,
  profile?: string,
): CachedSession[] {
  const SESSIONS_DIR = sessionsDir(profile);
  if (!existsSync(SESSIONS_DIR)) return [];

  const sessions: CachedSession[] = [];
  for (const file of readdirSync(SESSIONS_DIR)) {
    if (!file.startsWith("session_") || !file.endsWith(".json")) continue;

    try {
      const payload = JSON.parse(readFileSync(join(SESSIONS_DIR, file), "utf-8"));
      const id = String(payload.session_id || file.slice(8, -5));
      if (!id || dbIds.has(id)) continue;

      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const firstUserMessage = messages.find(
        (m) => m?.role === "user" && typeof m.content === "string",
      )?.content;
      const startedAt = Math.floor(
        Date.parse(payload.session_start || payload.last_updated || "") / 1000,
      );

      sessions.push({
        id,
        title: firstUserMessage
          ? generateTitle(firstUserMessage)
          : t("sessions.newConversation", getAppLocale()),
        startedAt: Number.isFinite(startedAt) ? startedAt : 0,
        source: payload.platform || "file",
        messageCount:
          typeof payload.message_count === "number"
            ? payload.message_count
            : messages.length,
        model: payload.model || "",
      });
    } catch {
      // Ignore malformed legacy transcript files.
    }
  }

  return sessions;
}

// Sync from hermes DB to local cache. Reconcile the full session index so a
// partial/stale cache cannot permanently hide older sessions.
export function syncSessionCache(profile?: string): CachedSession[] {
  const cache = readCache(profile);
  const db = getDb(profile);
  if (!db) {
    const fileSessions = readFileBackedSessions(new Set(), profile);
    if (fileSessions.length === 0) return cache.sessions;
    fileSessions.sort((a, b) => b.startedAt - a.startedAt);
    const updated: CacheData = {
      sessions: fileSessions,
      lastSync: Math.floor(Date.now() / 1000),
    };
    writeCache(updated, profile);
    return updated.sessions;
  }

  try {
    const rows = db
      .prepare(
        `SELECT
           s.id,
           s.started_at,
           s.source,
           s.message_count,
           s.model,
           s.title
         FROM sessions s
         ORDER BY s.started_at DESC`,
      )
      .all() as Array<{
      id: string;
      started_at: number;
      source: string;
      message_count: number;
      model: string;
      title: string | null;
    }>;

    // Index existing sessions by id once so the per-row update below is
    // O(1) instead of O(N). Without this, syncing N existing sessions
    // against N new rows is O(N²) and visibly slows app startup once a
    // user has accumulated thousands of sessions (issue #16).
    const existingById = new Map<string, CachedSession>();
    for (const s of cache.sessions) existingById.set(s.id, s);
    const newSessions: CachedSession[] = [];
    const firstMessages = new Map<string, string>();
    for (const msg of db
      .prepare(
        `SELECT m.session_id, m.content
         FROM messages m
         JOIN (
           SELECT session_id, MIN(id) AS first_id
           FROM messages
           WHERE role = 'user' AND content IS NOT NULL
           GROUP BY session_id
         ) first ON first.first_id = m.id`,
      )
      .all() as Array<{ session_id: string; content: string }>) {
      firstMessages.set(msg.session_id, msg.content);
    }

    for (const row of rows) {
      const existing = existingById.get(row.id);
      if (existing) {
        existing.startedAt = row.started_at;
        existing.source = row.source;
        existing.messageCount = row.message_count;
        existing.model = row.model || "";
        if (row.title) existing.title = row.title;
        continue;
      }

      // Generate title from first user message
      let title = row.title || "";
      if (!title) {
        const firstMessage = firstMessages.get(row.id);
        title = firstMessage
          ? generateTitle(firstMessage)
          : t("sessions.newConversation", getAppLocale());
      }

      newSessions.push({
        id: row.id,
        title,
        startedAt: row.started_at,
        source: row.source,
        messageCount: row.message_count,
        model: row.model || "",
      });
    }

    // Merge DB-backed sessions with legacy file-backed transcripts.
    const dbIds = new Set(rows.map((row) => row.id));
    const fileSessions = readFileBackedSessions(dbIds, profile);
    const fileIds = new Set(fileSessions.map((s) => s.id));
    const retainedSessions = cache.sessions.filter(
      (s) => dbIds.has(s.id) || fileIds.has(s.id),
    );
    const retainedIds = new Set(retainedSessions.map((s) => s.id));
    const allSessions = [
      ...newSessions,
      ...fileSessions.filter((s) => !retainedIds.has(s.id)),
      ...retainedSessions,
    ];
    // Sort by startedAt descending
    allSessions.sort((a, b) => b.startedAt - a.startedAt);

    const updated: CacheData = {
      sessions: allSessions,
      lastSync: Math.floor(Date.now() / 1000),
    };
    writeCache(updated, profile);
    return updated.sessions;
  } catch (err) {
    console.warn("Failed to sync Hermes session cache", err);
    return cache.sessions;
  } finally {
    db.close();
  }
}

// Fast read from cache only (no DB access)
export function listCachedSessions(
  limit = 50,
  offset = 0,
  profile?: string,
): CachedSession[] {
  const cache = readCache(profile);
  return cache.sessions.slice(offset, offset + limit);
}

// Update title for a specific session
export function updateSessionTitle(
  sessionId: string,
  title: string,
  profile?: string,
): void {
  const cache = readCache(profile);
  const idx = cache.sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    cache.sessions[idx].title = title;
    writeCache(cache, profile);
  }
}
