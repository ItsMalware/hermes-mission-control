import { useState } from "react";
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

function PlaceholderPanel({
  title,
  kicker,
  body,
  checks,
}: {
  title: string;
  kicker: string;
  body: string;
  checks: string[];
}): React.JSX.Element {
  return (
    <section className="self-panel">
      <div className="self-panel-header">
        <span>{kicker}</span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="self-checklist">
        {checks.map((check) => (
          <div key={check} className="self-check">
            <Check size={14} />
            <span>{check}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Self({ profile }: SelfProps): React.JSX.Element {
  const [active, setActive] = useState<SelfTool>("journal");
  const activeTool = SELF_TOOLS.find((tool) => tool.id === active)!;

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

      {active === "journal" && (
        <PlaceholderPanel
          title="Journal"
          kicker="Daily notes"
          body="This will be the daily writing surface for check-ins, decisions, and short reflections."
          checks={[
            "One note per day",
            "Small entries first, structure second",
            "Keep private notes out of agent runtime config",
          ]}
        />
      )}

      {active === "vault-memory" && (
        <div className="self-memory-pane">
          <Memory profile={profile} />
        </div>
      )}

      {active === "daily-review" && (
        <PlaceholderPanel
          title="Daily Review"
          kicker="Operating check"
          body="This will pull together goals, open sessions, Kanban status, and notes that need follow-up."
          checks={[
            "What moved today?",
            "What is blocked?",
            "What should Hermes remember for tomorrow?",
          ]}
        />
      )}
    </div>
  );
}

export default Self;
