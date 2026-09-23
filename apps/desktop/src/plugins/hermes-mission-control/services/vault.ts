const VAULT_ROOT_KEY = 'hermes.self.vaultRoot'
const DEFAULT_VAULT_ROOT = '/Volumes/X_storage/Hermes_memory/Hermes OS/Self'

const FOLDERS: Record<string, string> = {
  journal: 'Journal',
  'daily-review': 'Daily Reviews',
}

function bridge() {
  return window.hermesDesktop
}

export function getVaultRoot(): string {
  return localStorage.getItem(VAULT_ROOT_KEY) ?? DEFAULT_VAULT_ROOT
}

export function setVaultRoot(root: string): void {
  localStorage.setItem(VAULT_ROOT_KEY, root)
}

function notePath(kind: string, date: string): string {
  const folder = FOLDERS[kind] ?? kind
  return `${getVaultRoot()}/${folder}/${date}.md`
}

export interface SelfWorkspaceInfo {
  vaultRoot: string
  baseDir: string
  detected: boolean
}

export interface SelfNote {
  kind: 'journal' | 'daily-review'
  date: string
  path: string
  content: string
  exists: boolean
}

export interface SearchNote {
  title: string
  relPath: string
  preview: string
}

export async function getWorkspace(): Promise<SelfWorkspaceInfo> {
  const root = getVaultRoot()
  const result = await bridge().readDir(root)
  return {
    vaultRoot: root,
    baseDir: root,
    detected: !result.error && result.entries.length > 0,
  }
}

export async function readNote(kind: 'journal' | 'daily-review', date: string): Promise<SelfNote> {
  const path = notePath(kind, date)
  try {
    const result = await bridge().readFileText(path)
    return { kind, date, path, content: result.text, exists: true }
  } catch {
    return { kind, date, path, content: '', exists: false }
  }
}

export async function writeNote(kind: 'journal' | 'daily-review', date: string, content: string): Promise<SelfNote> {
  const path = notePath(kind, date)
  const write = bridge().writeTextFile
  if (!write) throw new Error('File writing not available in this environment')
  await write(path, content)
  return { kind, date, path, content, exists: true }
}

export async function recentNotes(limit: number): Promise<{ notes: SearchNote[] }> {
  const root = getVaultRoot()
  const notes: SearchNote[] = []

  for (const folder of Object.values(FOLDERS)) {
    try {
      const result = await bridge().readDir(`${root}/${folder}`)
      if (result.error) continue
      for (const entry of result.entries) {
        if (entry.isDirectory || !entry.name.endsWith('.md')) continue
        notes.push({
          title: entry.name.replace(/\.md$/, ''),
          relPath: `${folder}/${entry.name}`,
          preview: folder,
        })
      }
    } catch { /* folder may not exist */ }
  }

  notes.sort((a, b) => b.title.localeCompare(a.title))
  return { notes: notes.slice(0, limit) }
}

export async function searchNotes(query: string, limit: number): Promise<{ notes: SearchNote[] }> {
  const all = await recentNotes(500)
  const q = query.toLowerCase()
  const matched = all.notes.filter(n =>
    n.title.toLowerCase().includes(q) || n.relPath.toLowerCase().includes(q)
  )
  return { notes: matched.slice(0, limit) }
}

export async function readNoteByPath(relPath: string): Promise<{ content: string }> {
  const path = `${getVaultRoot()}/${relPath}`
  const result = await bridge().readFileText(path)
  return { content: result.text }
}

export async function openFile(path: string): Promise<void> {
  const abs = path.startsWith('/') ? path : `${getVaultRoot()}/${path}`
  const reveal = bridge().revealPath
  if (reveal) await reveal(abs)
}

/* ── Vault graph ────────────────────────────────────────────────────────────
   Walk the vault for markdown files, parse [[wikilinks]] out of each, and
   assemble the node/link graph the Vault Graph canvas expects. */

export interface GraphNode {
  id: string
  label: string
  group: string
  degree: number
}

export interface GraphLink {
  source: string
  target: string
}

const MAX_GRAPH_FILES = 400
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g

async function walkMarkdown(dir: string, root: string, out: string[]): Promise<void> {
  if (out.length >= MAX_GRAPH_FILES) return
  let result
  try {
    result = await bridge().readDir(dir)
  } catch {
    return
  }
  if (result.error) return
  for (const entry of result.entries) {
    if (out.length >= MAX_GRAPH_FILES) break
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory) {
      await walkMarkdown(entry.path, root, out)
    } else if (entry.name.endsWith('.md')) {
      out.push(entry.path.slice(root.length + 1))
    }
  }
}

export async function vaultGraph(): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const root = getVaultRoot()
  const relPaths: string[] = []
  await walkMarkdown(root, root, relPaths)

  // Map a bare note name (no folder, no extension) to its relPath so a
  // [[wikilink]] can resolve to the file it points at.
  const byBaseName = new Map<string, string>()
  for (const rel of relPaths) {
    const base = rel.split('/').pop()!.replace(/\.md$/, '')
    if (!byBaseName.has(base)) byBaseName.set(base, rel)
  }

  const degree = new Map<string, number>()
  relPaths.forEach(rel => degree.set(rel, 0))
  const links: GraphLink[] = []

  for (const rel of relPaths) {
    let text = ''
    try {
      text = (await bridge().readFileText(`${root}/${rel}`)).text
    } catch {
      continue
    }
    WIKILINK_RE.lastIndex = 0
    let match: RegExpExecArray | null
    const seen = new Set<string>()
    while ((match = WIKILINK_RE.exec(text)) !== null) {
      const targetRel = byBaseName.get(match[1].trim())
      if (!targetRel || targetRel === rel || seen.has(targetRel)) continue
      seen.add(targetRel)
      links.push({ source: rel, target: targetRel })
      degree.set(rel, (degree.get(rel) ?? 0) + 1)
      degree.set(targetRel, (degree.get(targetRel) ?? 0) + 1)
    }
  }

  const nodes: GraphNode[] = relPaths.map(rel => ({
    id: rel,
    label: rel.split('/').pop()!.replace(/\.md$/, ''),
    group: rel.includes('/') ? rel.split('/')[0] : 'root',
    degree: degree.get(rel) ?? 0,
  }))

  return { nodes, links }
}
