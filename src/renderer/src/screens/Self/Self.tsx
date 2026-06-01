import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Check,
  Clock,
  Timer,
} from "../../assets/icons";
import type { LucideIcon } from "lucide-react";
import Memory from "../Memory/Memory";

type SelfTool = "journal" | "vault-memory" | "daily-review";

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
    id: "vault-memory",
    label: "Vault Memory",
    icon: Brain,
    summary: "Hermes memory and vault-backed recall.",
  },
  {
    id: "daily-review",
    label: "Daily Review",
    icon: Timer,
    summary: "A compact end-of-day operating check.",
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

function Self({ profile }: SelfProps): React.JSX.Element {
  const [active, setActive] = useState<SelfTool>("journal");
  const [workspace, setWorkspace] = useState<SelfWorkspaceInfo | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const activeTool = SELF_TOOLS.find((tool) => tool.id === active)!;

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
    </div>
  );
}

export default Self;
