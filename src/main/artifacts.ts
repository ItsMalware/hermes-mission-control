import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "fs";
import { homedir } from "os";
import {
  basename,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "path";
import { shell } from "electron";
import { HERMES_HOME } from "./installer";

export type ArtifactKind = "text" | "image" | "video" | "audio" | "pdf" | "binary";

export interface ArtifactBucket {
  id: string;
  label: string;
  description: string;
  roots: string[];
  fileCount: number;
  mtime: number;
}

export interface ArtifactFile {
  name: string;
  relPath: string;
  bytes: number;
  mtime: number;
  kind: ArtifactKind;
  isText: boolean;
}

interface BucketDef {
  id: string;
  label: string;
  description: string;
  roots: string[];
  kindsAllow?: ArtifactKind[];
  extsAllow?: string[];
  maxDepth?: number;
}

const HOME = homedir();
const MAX_FILES = 500;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_DATA_URL_BYTES = 50 * 1024 * 1024;
const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "__pycache__", ".next", "dist", "build"]);

const TEXT_EXTS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".sh",
  ".log",
  ".csv",
  ".tsv",
  ".xml",
  ".toml",
  ".env",
  ".svg",
  ".rs",
  ".go",
  ".rb",
]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".bmp", ".tiff"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v", ".mkv"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".opus"]);

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".opus": "audio/opus",
  ".pdf": "application/pdf",
};

function activeProfile(profile?: string): string {
  if (profile && /^[A-Za-z0-9_.-]+$/.test(profile)) return profile;
  try {
    const raw = readFileSync(join(HERMES_HOME, "active_profile"), "utf-8").trim();
    if (raw && /^[A-Za-z0-9_.-]+$/.test(raw)) return raw;
  } catch {
    // fall through
  }
  return "default";
}

function profileRoot(profile?: string): string {
  const name = activeProfile(profile);
  return name === "default" ? HERMES_HOME : join(HERMES_HOME, "profiles", name);
}

function bucketDefs(profile?: string): BucketDef[] {
  const profileDir = profileRoot(profile);
  return [
    {
      id: "goals",
      label: "Goal Mode",
      roots: [join(HERMES_HOME, "goals")],
      description: "Files produced by autonomous Goal Mode runs.",
      maxDepth: 4,
    },
    {
      id: "apps",
      label: "Apps",
      roots: [HOME, join(HOME, "Guides"), join(profileDir, "workspace")],
      description: "HTML apps and pages Hermes has generated.",
      extsAllow: [".html", ".htm"],
      maxDepth: 0,
    },
    {
      id: "videos",
      label: "Videos",
      roots: [HOME, join(profileDir, "workspace"), join(HERMES_HOME, "videos")],
      description: "Rendered videos and motion outputs.",
      kindsAllow: ["video"],
      maxDepth: 0,
    },
    {
      id: "images",
      label: "Images",
      roots: [join(HERMES_HOME, "images")],
      description: "Image generation outputs from Hermes.",
      kindsAllow: ["image"],
      maxDepth: 4,
    },
    {
      id: "audio",
      label: "Audio",
      roots: [join(profileDir, "audio_cache"), join(HERMES_HOME, "audio_cache")],
      description: "Voice and TTS renders.",
      kindsAllow: ["audio"],
      maxDepth: 4,
    },
    {
      id: "workspace",
      label: "Workspace",
      roots: [join(profileDir, "workspace")],
      description: "Profile scratch space and generated working files.",
      maxDepth: 4,
    },
    {
      id: "sandboxes",
      label: "Sandboxes",
      roots: [join(HERMES_HOME, "sandboxes"), join(profileDir, "sandboxes")],
      description: "Sandboxed execution environments.",
      maxDepth: 4,
    },
    {
      id: "pastes",
      label: "Pastes",
      roots: [join(profileDir, "pastes"), join(HERMES_HOME, "pastes")],
      description: "Text dumps captured during sessions.",
      kindsAllow: ["text"],
      maxDepth: 4,
    },
  ];
}

export function artifactKind(name: string): ArtifactKind {
  const ext = extname(name).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (ext === ".pdf") return "pdf";
  if (TEXT_EXTS.has(ext)) return "text";
  return "binary";
}

function isInside(root: string, target: string): boolean {
  const rootResolved = resolve(root);
  const targetResolved = resolve(target);
  return targetResolved === rootResolved || targetResolved.startsWith(rootResolved + sep);
}

function walkBucket(def: BucketDef, maxFiles = MAX_FILES): ArtifactFile[] {
  const out: ArtifactFile[] = [];
  const seen = new Set<string>();
  const allowedKinds = def.kindsAllow ? new Set(def.kindsAllow) : null;
  const allowedExts = def.extsAllow ? new Set(def.extsAllow.map((ext) => ext.toLowerCase())) : null;
  const depthCap = def.maxDepth ?? 4;

  for (const root of def.roots) {
    if (!existsSync(root)) continue;
    const rootResolved = resolve(root);

    function walk(dir: string, depth: number): void {
      if (out.length >= maxFiles || depth > depthCap || !isInside(rootResolved, dir)) return;
      let items;
      try {
        items = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const item of items) {
        if (out.length >= maxFiles) break;
        if (SKIP_DIRS.has(item.name)) continue;
        if (dir === HOME && item.name.startsWith(".")) continue;
        const full = join(dir, item.name);
        if (!isInside(rootResolved, full)) continue;

        if (item.isDirectory()) {
          walk(full, depth + 1);
          continue;
        }
        if (!item.isFile()) continue;

        const kind = artifactKind(item.name);
        if (allowedKinds && !allowedKinds.has(kind)) continue;
        if (allowedExts && !allowedExts.has(extname(item.name).toLowerCase())) continue;
        const resolved = resolve(full);
        if (seen.has(resolved)) continue;
        seen.add(resolved);

        try {
          const st = statSync(resolved);
          out.push({
            name: item.name,
            relPath: relative(rootResolved, resolved),
            bytes: st.size,
            mtime: st.mtimeMs,
            kind,
            isText: kind === "text",
          });
        } catch {
          // ignore unreadable files
        }
      }
    }

    walk(rootResolved, 0);
  }

  return out.sort((a, b) => b.mtime - a.mtime).slice(0, maxFiles);
}

export function listArtifactBuckets(profile?: string): ArtifactBucket[] {
  return bucketDefs(profile).map((def) => {
    const files = walkBucket(def);
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      roots: def.roots.filter((root) => existsSync(root)),
      fileCount: files.length,
      mtime: files.reduce((latest, file) => Math.max(latest, file.mtime), 0),
    };
  });
}

export function listArtifactFiles(bucketId: string, profile?: string): ArtifactFile[] {
  const def = bucketDefs(profile).find((bucket) => bucket.id === bucketId);
  if (!def) return [];
  return walkBucket(def, 250);
}

export function resolveArtifactPath(bucketId: string, relPath: string, profile?: string): string | null {
  const def = bucketDefs(profile).find((bucket) => bucket.id === bucketId);
  if (!def || !relPath || relPath.includes("\0")) return null;
  for (const root of def.roots) {
    if (!existsSync(root)) continue;
    const rootResolved = resolve(root);
    const target = resolve(rootResolved, relPath);
    if (!isInside(rootResolved, target)) continue;
    try {
      if (statSync(target).isFile()) return target;
    } catch {
      // try next root
    }
  }
  return null;
}

export function readArtifactText(bucketId: string, relPath: string, profile?: string): { content: string; bytes: number; truncated: boolean } | null {
  const filePath = resolveArtifactPath(bucketId, relPath, profile);
  if (!filePath || artifactKind(filePath) !== "text") return null;
  const st = statSync(filePath);
  const bytes = Math.min(st.size, MAX_TEXT_BYTES);
  const buffer = readFileSync(filePath).subarray(0, bytes);
  return {
    content: buffer.toString("utf-8"),
    bytes: st.size,
    truncated: st.size > MAX_TEXT_BYTES,
  };
}

export function readArtifactDataUrl(bucketId: string, relPath: string, profile?: string): string | null {
  const filePath = resolveArtifactPath(bucketId, relPath, profile);
  if (!filePath) return null;
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) return null;
  const st = statSync(filePath);
  if (st.size > MAX_DATA_URL_BYTES) return null;
  return `data:${mime};base64,${readFileSync(filePath).toString("base64")}`;
}

export function showArtifactInFolder(bucketId: string, relPath: string, profile?: string): boolean {
  const filePath = resolveArtifactPath(bucketId, relPath, profile);
  if (!filePath) return false;
  shell.showItemInFolder(filePath);
  return true;
}

export function artifactDisplayName(relPath: string): string {
  return basename(relPath);
}
