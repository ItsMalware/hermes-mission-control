import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
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

// Recursive walker to find all .md files in the vault (excluding hidden directories/files)
function walkMdFiles(
  dir: string,
  vaultRoot: string,
  results: { absPath: string; relPath: string; mtime: number }[] = [],
): { absPath: string; relPath: string; mtime: number }[] {
  if (!existsSync(dir)) return results;
  try {
    const list = readdirSync(dir);
    for (const file of list) {
      if (file.startsWith(".")) continue;
      const absPath = join(dir, file);
      try {
        const stat = statSync(absPath);
        if (stat.isDirectory()) {
          if (file !== "node_modules") {
            walkMdFiles(absPath, vaultRoot, results);
          }
        } else if (file.endsWith(".md")) {
          const relPath = absPath.slice(vaultRoot.length).replace(/^[/\\]+/, "");
          results.push({
            absPath,
            relPath,
            mtime: stat.mtimeMs,
          });
        }
      } catch {
        // Ignore single file/folder stat errors
      }
    }
  } catch {
    // Ignore folder readdir errors
  }
  return results;
}

export interface SelfSearchMatch {
  title: string;
  relPath: string;
  mtime: number;
  preview: string;
  score: number;
}

export function selfSearchNotes(query: string, limit = 50): SelfSearchMatch[] {
  const workspace = getSelfWorkspace();
  const vaultRoot = workspace.vaultRoot;
  const files = walkMdFiles(vaultRoot, vaultRoot);
  const q = query.toLowerCase().trim();

  const matches: SelfSearchMatch[] = [];
  for (const file of files) {
    const title = basename(file.absPath, ".md");
    let content = "";
    try {
      content = readFileSync(file.absPath, "utf-8");
    } catch {
      continue;
    }

    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    let score = 0;
    if (q) {
      if (titleLower.includes(q)) {
        score += 10;
        if (titleLower === q) score += 10;
      }
      if (contentLower.includes(q)) {
        score += 1;
        const occurrences = contentLower.split(q).length - 1;
        score += Math.min(occurrences, 5);
      }
      if (score === 0) continue;
    } else {
      score = 1;
    }

    // Strip frontmatter for preview text
    let cleanContent = content;
    if (content.startsWith("---")) {
      const parts = content.split("---");
      if (parts.length >= 3) {
        cleanContent = parts.slice(2).join("---");
      }
    }
    const cleanText = cleanContent
      .replace(/#+\s+/g, "")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    const preview = cleanText.slice(0, 160) + (cleanText.length > 160 ? "..." : "");

    matches.push({
      title,
      relPath: file.relPath,
      mtime: file.mtime,
      preview,
      score,
    });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.mtime - a.mtime;
  });

  return matches.slice(0, limit);
}

export function selfRecentNotes(limit = 50): SelfSearchMatch[] {
  const workspace = getSelfWorkspace();
  const vaultRoot = workspace.vaultRoot;
  const files = walkMdFiles(vaultRoot, vaultRoot);

  const matches: SelfSearchMatch[] = [];
  for (const file of files) {
    const title = basename(file.absPath, ".md");
    let content = "";
    try {
      content = readFileSync(file.absPath, "utf-8");
    } catch {
      continue;
    }

    let cleanContent = content;
    if (content.startsWith("---")) {
      const parts = content.split("---");
      if (parts.length >= 3) {
        cleanContent = parts.slice(2).join("---");
      }
    }
    const cleanText = cleanContent
      .replace(/#+\s+/g, "")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    const preview = cleanText.slice(0, 160) + (cleanText.length > 160 ? "..." : "");

    matches.push({
      title,
      relPath: file.relPath,
      mtime: file.mtime,
      preview,
      score: 1,
    });
  }

  matches.sort((a, b) => b.mtime - a.mtime);
  return matches.slice(0, limit);
}

export function selfReadNoteByPath(relPath: string): string {
  const workspace = getSelfWorkspace();
  const vaultRoot = workspace.vaultRoot;
  const fullPath = ensureInsideVault(vaultRoot, join(vaultRoot, relPath));
  if (!existsSync(fullPath)) {
    throw new Error(`Note not found: ${relPath}`);
  }
  return readFileSync(fullPath, "utf-8");
}

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  degree: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface VaultGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function selfGetVaultGraph(): VaultGraphData {
  const workspace = getSelfWorkspace();
  const vaultRoot = workspace.vaultRoot;
  const files = walkMdFiles(vaultRoot, vaultRoot);

  const nodesMap = new Map<string, GraphNode>();
  const titleToPathMap = new Map<string, string>();

  for (const file of files) {
    const title = basename(file.absPath, ".md");
    const dirName = basename(resolve(file.absPath, ".."));
    const group = dirName === basename(vaultRoot) ? "root" : dirName;

    nodesMap.set(file.relPath, {
      id: file.relPath,
      label: title,
      group,
      degree: 0,
    });

    titleToPathMap.set(title.toLowerCase(), file.relPath);
  }

  const links: GraphLink[] = [];
  const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

  for (const file of files) {
    let content = "";
    try {
      content = readFileSync(file.absPath, "utf-8");
    } catch {
      continue;
    }

    let match;
    WIKILINK_RE.lastIndex = 0;
    while ((match = WIKILINK_RE.exec(content)) !== null) {
      const targetTitle = match[1].trim();
      const targetPath = titleToPathMap.get(targetTitle.toLowerCase());
      if (targetPath && targetPath !== file.relPath) {
        const linkExists = links.some(
          (l) => l.source === file.relPath && l.target === targetPath,
        );
        if (!linkExists) {
          links.push({
            source: file.relPath,
            target: targetPath,
          });

          const srcNode = nodesMap.get(file.relPath);
          if (srcNode) srcNode.degree++;
          const tgtNode = nodesMap.get(targetPath);
          if (tgtNode) tgtNode.degree++;
        }
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links,
  };
}
