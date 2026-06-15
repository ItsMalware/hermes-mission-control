import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Check,
  Clock,
  Timer,
  Search,
  Workflow,
} from "../../assets/icons";
import type { LucideIcon } from "lucide-react";
import Memory from "../Memory/Memory";
import { VaultGraph3D } from "./VaultGraph3D";
import SEOView from "./SEOView";
import NotebookView from "./NotebookView";
import { Target, BookOpen } from "lucide-react";

type SelfTool = "journal" | "daily-review" | "note-search" | "vault-graph" | "vault-memory" | "seo-pipeline" | "notebook";

interface SelfProps {
  profile?: string;
}

interface SelfWorkspaceInfo {
  vaultRoot: string;
  baseDir: string;
  detected: boolean;
}

interface SelfNote {
  kind: "journal" | "daily-review";
  date: string;
  path: string;
  content: string;
  exists: boolean;
}

const SELF_TOOLS: Array<{
  id: SelfTool;
  label: string;
  icon: LucideIcon;
  summary: string;
}> = [
  {
    id: "journal",
    label: "Journal",
    icon: Clock,
    summary: "Daily notes for your Obsidian vault.",
  },
  {
    id: "daily-review",
    label: "Daily Review",
    icon: Timer,
    summary: "A compact end-of-day operating check.",
  },
  {
    id: "note-search",
    label: "Note Search",
    icon: Search,
    summary: "Find and preview any Obsidian note.",
  },
  {
    id: "vault-graph",
    label: "Vault Graph",
    icon: Workflow,
    summary: "Interactive pseudo-3D vault connection map.",
  },
  {
    id: "vault-memory",
    label: "Vault Memory",
    icon: Brain,
    summary: "Hermes memory and vault-backed recall.",
  },
  {
    id: "seo-pipeline",
    label: "SEO Pipeline",
    icon: Target,
    summary: "Manage SEO content pipelines.",
  },
  {
    id: "notebook",
    label: "Notebook",
    icon: BookOpen,
    summary: "Interact with the local notebook environment.",
  },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function NoteEditor({
  kind,
  title,
  kicker,
  description,
  workspace,
  onWorkspaceChange,
}: {
  kind: "journal" | "daily-review";
  title: string;
  kicker: string;
  description: string;
  workspace: SelfWorkspaceInfo | null;
  onWorkspaceChange: () => Promise<void>;
}): React.JSX.Element {
  const [date, setDate] = useState(today());
  const [note, setNote] = useState<SelfNote | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const loadNote = useCallback(async () => {
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const loaded = await window.hermesAPI.selfReadNote(kind, date);
      setNote(loaded);
      setContent(loaded.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [date, kind]);

  useEffect(() => {
    void loadNote();
  }, [loadNote]);

  async function save(): Promise<void> {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const written = await window.hermesAPI.selfWriteNote(kind, date, content);
      setNote(written);
      setContent(written.content);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function openFile(): Promise<void> {
    if (note?.path) await window.hermesAPI.openFileInEditor(note.path);
  }

  return (
    <section className="self-panel self-note-panel">
      <div className="self-panel-header self-note-header">
        <div>
          <span>{kicker}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="self-note-actions">
          <input
            className="input self-date-input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <button className="btn-ghost" type="button" onClick={loadNote}>
            Refresh
          </button>
          <button className="btn-primary" type="button" onClick={save}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="self-vault-row">
        <div>
          <strong>Vault</strong>
          <span>{workspace?.vaultRoot || "No vault selected"}</span>
        </div>
        <button className="btn-ghost" type="button" onClick={onWorkspaceChange}>
          Change Vault
        </button>
      </div>

      {error && <div className="self-error">{error}</div>}
      {saved && (
        <div className="self-saved">
          <Check size={14} />
          Saved
        </div>
      )}

      <textarea
        className="self-note-editor"
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setSaved(false);
        }}
        spellCheck
        disabled={loading}
      />

      <div className="self-note-footer">
        <span>{note?.exists ? "Existing note" : "New note template"}</span>
        <button
          className="btn-ghost"
          type="button"
          onClick={openFile}
          disabled={!note?.path}
          title={note?.path || undefined}
        >
          Open Markdown File
        </button>
      </div>
    </section>
  );
}

interface NoteSearchProps {
  initialSelectedPath: string | null;
  onClearInitialPath: () => void;
}

function NoteSearch({
  initialSelectedPath,
  onClearInitialPath,
}: NoteSearchProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [selectedContent, setSelectedContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const loadRecent = async () => {
    setLoading(true);
    try {
      const recent = await window.hermesAPI.selfRecentNotes(30);
      setNotes(recent);
      if (recent.length > 0 && !initialSelectedPath) {
        handleSelectNote(recent[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    if (!query) {
      loadRecent();
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await window.hermesAPI.selfSearchNotes(query, 30);
        setNotes(results);
        if (results.length > 0) {
          handleSelectNote(results[0]);
        } else {
          setSelectedNote(null);
          setSelectedContent("");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle graph click redirection
  useEffect(() => {
    if (initialSelectedPath) {
      const loadInitial = async () => {
        setLoading(true);
        try {
          const title =
            initialSelectedPath.split("/").pop()?.replace(".md", "") ||
            initialSelectedPath;
          const noteObj = {
            title,
            relPath: initialSelectedPath,
            preview: "",
          };
          await handleSelectNote(noteObj);
          setQuery(title);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
          onClearInitialPath();
        }
      };
      void loadInitial();
    }
  }, [initialSelectedPath]);

  const handleSelectNote = async (note: any) => {
    setSelectedNote(note);
    try {
      const content = await window.hermesAPI.selfReadNoteByPath(note.relPath);
      setSelectedContent(content);
    } catch (err) {
      console.error(err);
      setSelectedContent("Failed to load note content.");
    }
  };

  return (
    <div
      className="self-panel"
      style={{ display: "flex", gap: 20, height: 600, minHeight: 600 }}
    >
      <div
        style={{
          flex: "0 0 320px",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div className="self-search-bar">
          <input
            className="self-search-input"
            type="text"
            placeholder="Search notes by title or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {loading && notes.length === 0 ? (
          <div className="self-graph-loading" style={{ minHeight: 150 }}>
            <div className="loading-spinner" />
          </div>
        ) : (
          <div className="self-notes-list" style={{ flex: 1, overflowY: "auto" }}>
            {notes.map((n) => (
              <div
                key={n.relPath}
                className={`self-note-item ${selectedNote?.relPath === n.relPath ? "active" : ""}`}
                style={{
                  borderColor:
                    selectedNote?.relPath === n.relPath
                      ? "var(--accent)"
                      : undefined,
                  background:
                    selectedNote?.relPath === n.relPath
                      ? "rgba(168, 85, 247, 0.08)"
                      : undefined,
                }}
                onClick={() => handleSelectNote(n)}
              >
                <div className="self-note-item-title">{n.title}</div>
                <div className="self-note-item-preview">{n.preview}</div>
                <div className="self-note-item-path">{n.relPath}</div>
              </div>
            ))}
            {notes.length === 0 && (
              <div className="artifacts-empty" style={{ padding: 20 }}>
                No notes found.
              </div>
            )}
          </div>
        )}
      </div>
      <div
        className="self-note-view-pane"
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        {selectedNote ? (
          <>
            <div className="self-note-view-header">
              <div>
                <strong style={{ fontSize: 14 }}>{selectedNote.title}</strong>
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  {selectedNote.relPath}
                </div>
              </div>
              <button
                className="btn-ghost"
                onClick={() =>
                  window.hermesAPI.openFileInEditor(selectedNote.relPath)
                }
              >
                Open File
              </button>
            </div>
            <div className="self-note-view-body" style={{ flex: 1, overflowY: "auto" }}>
              {selectedContent}
            </div>
          </>
        ) : (
          <div className="artifacts-empty" style={{ margin: "auto" }}>
            Select a note to preview.
          </div>
        )}
      </div>
    </div>
  );
}

function Self({ profile }: SelfProps): React.JSX.Element {
  const [active, setActive] = useState<SelfTool>("journal");
  const [workspace, setWorkspace] = useState<SelfWorkspaceInfo | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const activeTool = SELF_TOOLS.find((tool) => tool.id === active)!;

  // Selected path from vault graph click redirection
  const [selectedPathFromGraph, setSelectedPathFromGraph] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      setWorkspace(await window.hermesAPI.selfGetWorkspace());
      setWorkspaceError("");
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function chooseWorkspace(): Promise<void> {
    const folder = await window.hermesAPI.selectFolder();
    if (!folder) return;
    try {
      setWorkspace(await window.hermesAPI.selfSetVaultRoot(folder));
      setWorkspaceError("");
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="self-container">
      <header className="self-header">
        <div>
          <div className="self-kicker">Personal OS</div>
          <h1>Self</h1>
          <p>
            Journaling, vault memory, and daily review in one quiet workspace.
          </p>
        </div>
      </header>

      <nav className="self-tool-tabs" aria-label="Self tools">
        {SELF_TOOLS.map(({ id, label, icon: Icon, summary }) => (
          <button
            key={id}
            className={active === id ? "active" : ""}
            type="button"
            onClick={() => setActive(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
            <small>{summary}</small>
          </button>
        ))}
      </nav>

      <div className="self-active-label">
        <activeTool.icon size={15} />
        <span>{activeTool.label}</span>
      </div>

      {workspaceError && <div className="self-error">{workspaceError}</div>}

      {active === "journal" && (
        <NoteEditor
          kind="journal"
          title="Journal"
          kicker="Daily notes"
          description="A real daily markdown note for check-ins, decisions, and short reflections."
          workspace={workspace}
          onWorkspaceChange={chooseWorkspace}
        />
      )}

      {active === "vault-memory" && (
        <div className="self-memory-pane">
          <Memory profile={profile} />
        </div>
      )}

      {active === "daily-review" && (
        <NoteEditor
          kind="daily-review"
          title="Daily Review"
          kicker="Operating check"
          description="A date-based markdown closeout for what moved, what is blocked, and what Hermes should remember tomorrow."
          workspace={workspace}
          onWorkspaceChange={chooseWorkspace}
        />
      )}

      {active === "note-search" && (
        <NoteSearch
          initialSelectedPath={selectedPathFromGraph}
          onClearInitialPath={() => setSelectedPathFromGraph(null)}
        />
      )}

      {active === "vault-graph" && (
        <VaultGraph3D
          onSelectNote={(relPath) => {
            setSelectedPathFromGraph(relPath);
            setActive("note-search");
          }}
        />
      )}

      {active === "seo-pipeline" && (
        <div className="self-panel" style={{ height: "calc(100vh - 200px)" }}>
          <SEOView />
        </div>
      )}

      {active === "notebook" && (
        <div className="self-panel" style={{ height: "calc(100vh - 200px)", padding: 0 }}>
          <NotebookView />
        </div>
      )}
    </div>
  );
}

export default Self;
