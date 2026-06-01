import { existsSync, mkdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { basename, join, resolve } from "path";
import { readDesktopConfig, writeDesktopConfig } from "./config";
import { safeWriteFile } from "./utils";

export type SelfNoteKind = "journal" | "daily-review";

export interface SelfWorkspaceInfo {
  vaultRoot: string;
  baseDir: string;
  detected: boolean;
}

export interface SelfNote {
  kind: SelfNoteKind;
  date: string;
  path: string;
  content: string;
  exists: boolean;
}

const SELF_VAULT_KEY = "selfVaultRoot";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function commonVaultCandidates(): string[] {
  const home = homedir();
  return [
    join(home, "Documents", "Obsidian Vault"),
    join(home, "Obsidian Vault"),
    join(home, "Obsidian"),
  ];
}

function detectVaultRoot(): { root: string; detected: boolean } {
  const config = readDesktopConfig();
  const configured =
    typeof config[SELF_VAULT_KEY] === "string"
      ? config[SELF_VAULT_KEY].trim()
      : "";
  if (configured && existsSync(configured)) {
    return { root: configured, detected: false };
  }

  const found = commonVaultCandidates().find((candidate) =>
    existsSync(candidate),
  );
  if (found) return { root: found, detected: true };

  return {
    root: join(homedir(), "Documents", "Obsidian Vault"),
    detected: true,
  };
}

function ensureInsideVault(vaultRoot: string, target: string): string {
  const root = resolve(vaultRoot);
  const resolved = resolve(target);
  if (resolved !== root && !resolved.startsWith(root + "/")) {
    throw new Error("Self note path escaped the configured vault root.");
  }
  return resolved;
}

function normalizeDate(date?: string): string {
  const value = date || today();
  if (!DATE_RE.test(value)) throw new Error("Date must use YYYY-MM-DD.");
  return value;
}

export function setSelfVaultRoot(vaultRoot: string): SelfWorkspaceInfo {
  if (!vaultRoot || !existsSync(vaultRoot)) {
    throw new Error("Selected vault folder does not exist.");
  }
  const config = readDesktopConfig();
  config[SELF_VAULT_KEY] = vaultRoot;
  writeDesktopConfig(config);
  return getSelfWorkspace();
}

export function getSelfWorkspace(): SelfWorkspaceInfo {
  const { root, detected } = detectVaultRoot();
  const baseDir = ensureInsideVault(root, join(root, "Hermes OS", "Self"));
  mkdirSync(baseDir, { recursive: true });
  return { vaultRoot: root, baseDir, detected };
}

function notePath(kind: SelfNoteKind, date?: string): string {
  const workspace = getSelfWorkspace();
  const day = normalizeDate(date);
  const folder = kind === "journal" ? "Journal" : "Daily Reviews";
  return ensureInsideVault(workspace.vaultRoot, join(workspace.baseDir, folder, `${day}.md`));
}

function titleFor(kind: SelfNoteKind, date: string): string {
  return kind === "journal"
    ? `# Journal - ${date}`
    : `# Daily Review - ${date}`;
}

function templateFor(kind: SelfNoteKind, date: string): string {
  const tag = kind === "journal" ? "journal" : "daily-review";
  if (kind === "journal") {
    return `---\ntags: [hermes-os, self, ${tag}]\ndate: ${date}\n---\n\n${titleFor(kind, date)}\n\n## Notes\n\n\n## Decisions\n\n\n## Follow-ups\n\n`;
  }

  return `---\ntags: [hermes-os, self, ${tag}]\ndate: ${date}\n---\n\n${titleFor(kind, date)}\n\n## Moved Today\n\n- \n\n## Blocked\n\n- \n\n## Remember Tomorrow\n\n- \n\n## Closeout\n\n- [ ] Important notes captured\n- [ ] Follow-ups moved to Kanban or calendar\n- [ ] Tomorrow's first action is clear\n`;
}

export function readSelfNote(kind: SelfNoteKind, date?: string): SelfNote {
  const day = normalizeDate(date);
  const path = notePath(kind, day);
  const exists = existsSync(path);
  const content = exists ? readFileSync(path, "utf-8") : templateFor(kind, day);
  if (!exists) safeWriteFile(path, content);
  return { kind, date: day, path, content, exists: true };
}

export function writeSelfNote(
  kind: SelfNoteKind,
  date: string | undefined,
  content: string,
): SelfNote {
  const day = normalizeDate(date);
  const path = notePath(kind, day);
  safeWriteFile(path, content);
  return {
    kind,
    date: day,
    path,
    content,
    exists: true,
  };
}

export function selfNoteDisplayName(notePathValue: string): string {
  return basename(notePathValue);
}
