import { useCallback, useEffect, useState } from 'react'

import {
  cn,
  Codicon,
  EmptyState,
  host,
  Loader,
  Tabs,
  TabsList,
  TabsTrigger,
  Button,
} from '@hermes/plugin-sdk'

import { Wallpaper } from '../wallpaper'
import { VaultGraph3D } from '../components/vault-graph'
import { MemoryEditor } from '../components/memory-editor'
import { SEOEmbed } from './seo'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SelfTool =
  | 'journal'
  | 'daily-review'
  | 'note-search'
  | 'seo'
  | 'vault-graph'
  | 'vault-memory'
  | 'notebook'

interface SelfWorkspaceInfo {
  vaultRoot: string
  baseDir: string
  detected: boolean
}

interface SelfNote {
  kind: 'journal' | 'daily-review'
  date: string
  path: string
  content: string
  exists: boolean
}

interface SearchNote {
  title: string
  relPath: string
  preview: string
}

const SELF_TOOLS: Array<{
  id: SelfTool
  label: string
  icon: string
  summary: string
  deferred?: boolean
}> = [
  {
    id: 'journal',
    label: 'Journal',
    icon: 'history',
    summary: 'Daily notes for your Obsidian vault.',
  },
  {
    id: 'daily-review',
    label: 'Daily Review',
    icon: 'watch',
    summary: 'A compact end-of-day operating check.',
  },
  {
    id: 'note-search',
    label: 'Note Search',
    icon: 'search',
    summary: 'Find and preview any Obsidian note.',
  },
  {
    id: 'seo',
    label: 'OpenSEO',
    icon: 'globe',
    summary: 'The OpenSEO pipeline, embedded.',
  },
  {
    id: 'vault-graph',
    label: 'Vault Graph',
    icon: 'type-hierarchy',
    summary: 'Interactive pseudo-3D vault connection map.',
    deferred: true,
  },
  {
    id: 'vault-memory',
    label: 'Vault Memory',
    icon: 'lightbulb',
    summary: 'Hermes memory and vault-backed recall.',
    deferred: true,
  },
  {
    id: 'notebook',
    label: 'Notebook',
    icon: 'notebook',
    summary: 'Interact with the local notebook environment.',
    deferred: true,
  },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/*  NoteEditor                                                         */
/* ------------------------------------------------------------------ */

function NoteEditor({
  kind,
  title,
  kicker,
  description,
  workspace,
}: {
  kind: 'journal' | 'daily-review'
  title: string
  kicker: string
  description: string
  workspace: SelfWorkspaceInfo | null
}) {
  const [date, setDate] = useState(today())
  const [note, setNote] = useState<SelfNote | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const loadNote = useCallback(async () => {
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      const loaded = await host.request<SelfNote>('self.readNote', {
        kind,
        date,
      })
      setNote(loaded)
      setContent(loaded.content)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('not implemented') || msg.includes('not found')) {
        setError(
          'Vault not connected. Note operations will be available once the vault backend is wired.'
        )
      } else {
        setError(msg)
      }
      setNote(null)
      setContent('')
    } finally {
      setLoading(false)
    }
  }, [date, kind])

  useEffect(() => {
    void loadNote()
  }, [loadNote])

  async function save(): Promise<void> {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const written = await host.request<SelfNote>('self.writeNote', {
        kind,
        date,
        content,
      })
      setNote(written)
      setContent(written.content)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('not implemented') || msg.includes('not found')) {
        setError(
          'Vault not connected. Save will be available once the vault backend is wired.'
        )
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  async function openFile(): Promise<void> {
    if (!note?.path) return
    try {
      await host.request('self.openFile', { path: note.path })
    } catch {
      // silently ignore if not wired
    }
  }

  return (
    <section className="self-panel self-note-panel">
      <div className="self-panel-header self-note-header">
        <div>
          <span className="text-xs uppercase tracking-wider text-(--ui-text-tertiary)">
            {kicker}
          </span>
          <h2 className="text-base font-semibold mt-0.5">{title}</h2>
          <p className="text-xs text-(--ui-text-secondary) mt-0.5">
            {description}
          </p>
        </div>
        <div className="self-note-actions">
          <input
            className="self-date-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <Button variant="ghost" size="sm" onClick={loadNote}>
            <Codicon name="refresh" size="0.75rem" />
            Refresh
          </Button>
          <Button variant="default" size="sm" onClick={save} disabled={saving}>
            <Codicon name="save" size="0.75rem" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="self-vault-row">
        <div>
          <strong className="text-xs">Vault</strong>
          <span className="text-xs text-(--ui-text-secondary) ml-2">
            {workspace?.vaultRoot || 'No vault selected'}
          </span>
        </div>
      </div>

      {error && <div className="self-error">{error}</div>}
      {saved && (
        <div className="self-saved">
          <Codicon name="check" size="0.75rem" />
          Saved
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader type="lemniscate-bloom" />
        </div>
      ) : (
        <textarea
          className="self-note-editor"
          value={content}
          onChange={e => {
            setContent(e.target.value)
            setSaved(false)
          }}
          spellCheck
          placeholder={
            error
              ? 'Vault connection required to load notes...'
              : `Start writing your ${kind === 'journal' ? 'journal entry' : 'daily review'}...`
          }
          disabled={loading}
        />
      )}

      <div className="self-note-footer">
        <span className="text-xs text-(--ui-text-tertiary)">
          {note?.exists ? 'Existing note' : 'New note template'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={openFile}
          disabled={!note?.path}
          title={note?.path || undefined}
        >
          <Codicon name="go-to-file" size="0.75rem" />
          Open Markdown File
        </Button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  NoteSearch                                                         */
/* ------------------------------------------------------------------ */

function NoteSearch() {
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<SearchNote[]>([])
  const [selectedNote, setSelectedNote] = useState<SearchNote | null>(null)
  const [selectedContent, setSelectedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadRecent = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await host.request<{ notes: SearchNote[] }>(
        'self.recentNotes',
        { limit: 30 }
      )
      setNotes(result.notes)
      if (result.notes.length > 0) {
        void handleSelectNote(result.notes[0])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('not implemented') || msg.includes('not found')) {
        setError(
          'Vault not connected. Note search will be available once the vault backend is wired.'
        )
      } else {
        setError(msg)
      }
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  useEffect(() => {
    if (!query) {
      void loadRecent()
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const result = await host.request<{ notes: SearchNote[] }>(
          'self.searchNotes',
          { query, limit: 30 }
        )
        setNotes(result.notes)
        if (result.notes.length > 0) {
          void handleSelectNote(result.notes[0])
        } else {
          setSelectedNote(null)
          setSelectedContent('')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('not implemented') || msg.includes('not found')) {
          setError('Vault not connected.')
        } else {
          setError(msg)
        }
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  async function handleSelectNote(note: SearchNote): Promise<void> {
    setSelectedNote(note)
    try {
      const result = await host.request<{ content: string }>(
        'self.readNoteByPath',
        { relPath: note.relPath }
      )
      setSelectedContent(result.content)
    } catch {
      setSelectedContent('Failed to load note content.')
    }
  }

  if (error && notes.length === 0) {
    return (
      <div className="self-panel">
        <EmptyState
          title="Note Search"
          description={error}
        />
      </div>
    )
  }

  return (
    <div
      className="self-panel"
      style={{ display: 'flex', gap: 20, height: 600, minHeight: 600 }}
    >
      {/* Left: search list */}
      <div
        style={{
          flex: '0 0 320px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div className="self-search-bar">
          <Codicon name="search" size="0.75rem" />
          <input
            className="self-search-input"
            type="text"
            placeholder="Search notes by title or content..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        {loading && notes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader type="lemniscate-bloom" />
          </div>
        ) : (
          <div
            className="self-notes-list"
            style={{ flex: 1, overflowY: 'auto' }}
          >
            {notes.map(n => (
              <div
                key={n.relPath}
                className={cn(
                  'self-note-item',
                  selectedNote?.relPath === n.relPath && 'active'
                )}
                onClick={() => void handleSelectNote(n)}
              >
                <div className="self-note-item-title">{n.title}</div>
                <div className="self-note-item-preview">{n.preview}</div>
                <div className="self-note-item-path">{n.relPath}</div>
              </div>
            ))}
            {notes.length === 0 && (
              <div className="flex items-center justify-center py-8 text-xs text-(--ui-text-tertiary)">
                No notes found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: preview pane */}
      <div
        className="self-note-view-pane"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {selectedNote ? (
          <>
            <div className="self-note-view-header">
              <div>
                <strong style={{ fontSize: 14 }}>{selectedNote.title}</strong>
                <div className="text-xs text-(--ui-text-tertiary)">
                  {selectedNote.relPath}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void host
                    .request('self.openFile', { path: selectedNote.relPath })
                    .catch(() => {})
                }}
              >
                <Codicon name="go-to-file" size="0.75rem" />
                Open File
              </Button>
            </div>
            <div
              className="self-note-view-body"
              style={{ flex: 1, overflowY: 'auto' }}
            >
              {selectedContent}
            </div>
          </>
        ) : (
          <EmptyState
            title="No note selected"
            description="Select a note from the list to preview its content."
          />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SelfPage (main export)                                             */
/* ------------------------------------------------------------------ */

export function SelfPage() {
  const [active, setActive] = useState<SelfTool>('journal')
  const [workspace, setWorkspace] = useState<SelfWorkspaceInfo | null>(null)
  const [workspaceError, setWorkspaceError] = useState('')

  const activeTool = SELF_TOOLS.find(t => t.id === active)!

  // Load workspace info on mount
  useEffect(() => {
    async function load() {
      try {
        const ws = await host.request<SelfWorkspaceInfo>(
          'self.getWorkspace',
          {}
        )
        setWorkspace(ws)
        setWorkspaceError('')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('not implemented') || msg.includes('not found')) {
          setWorkspaceError(
            'Vault backend not connected yet. Workspace detection will be available in a future update.'
          )
        } else {
          setWorkspaceError(msg)
        }
      }
    }
    void load()
  }, [])

  return (
    <div className="hmc-page">
      <Wallpaper />

      <header className="self-header">
        <div>
          <div className="self-kicker">Personal OS</div>
          <h1 className="hmc-page-title">Self</h1>
          <p className="text-sm text-(--ui-text-secondary)">
            Journaling, vault memory, and daily review in one quiet workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="mission-command"
            type="button"
            onClick={() => host.navigate('/mission-control')}
          >
            <Codicon name="dashboard" size="0.8rem" />
            <span>Mission Control</span>
          </button>
        </div>
      </header>

      {/* Tool tabs */}
      <Tabs value={active} onValueChange={v => setActive(v as SelfTool)}>
        <TabsList className="self-tool-tabs">
          {SELF_TOOLS.map(({ id, label, icon }) => (
            <TabsTrigger key={id} value={id}>
              <Codicon name={icon} size="0.75rem" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Active tool label */}
      <div className="self-active-label">
        <Codicon name={activeTool.icon} size="0.85rem" />
        <span>{activeTool.label}</span>
        <span className="text-xs text-(--ui-text-tertiary) ml-2">
          {activeTool.summary}
        </span>
      </div>

      {workspaceError && <div className="self-error">{workspaceError}</div>}

      {/* ---- Journal ---- */}
      {active === 'journal' && (
        <NoteEditor
          kind="journal"
          title="Journal"
          kicker="Daily notes"
          description="A real daily markdown note for check-ins, decisions, and short reflections."
          workspace={workspace}
        />
      )}

      {/* ---- Daily Review ---- */}
      {active === 'daily-review' && (
        <NoteEditor
          kind="daily-review"
          title="Daily Review"
          kicker="Operating check"
          description="A date-based markdown closeout for what moved, what is blocked, and what Hermes should remember tomorrow."
          workspace={workspace}
        />
      )}

      {/* ---- Note Search ---- */}
      {active === 'note-search' && <NoteSearch />}

      {/* ---- OpenSEO ---- */}
      {active === 'seo' && <SEOEmbed />}

      {/* ---- Vault Graph ---- */}
      {active === 'vault-graph' && (
        <div className="self-panel" style={{ minHeight: 500 }}>
          <VaultGraph3D
            onSelectNote={relPath => {
              void host
                .request('self.openFile', { path: relPath })
                .catch(() => {})
            }}
          />
        </div>
      )}

      {/* ---- Vault Memory ---- */}
      {active === 'vault-memory' && (
        <div className="self-panel">
          <MemoryEditor />
        </div>
      )}

      {/* ---- Deferred: Notebook ---- */}
      {active === 'notebook' && (
        <div className="self-panel">
          <EmptyState
            title="Notebook"
            description="The local notebook environment will be available in a future update. Interactive code and markdown notebooks are being ported to the plugin system."
          />
        </div>
      )}
    </div>
  )
}
