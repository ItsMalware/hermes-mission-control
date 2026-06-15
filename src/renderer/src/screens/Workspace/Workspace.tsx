import { useState } from "react";
import NotionTickets from "./NotionTickets";
import Office from "../Office/Office";
import Artifacts from "../Artifacts/Artifacts";
import Schedules from "../Schedules/Schedules";
import { ClipboardList, Building, Layers, Timer } from "../../assets/icons";

type WorkspaceTab = "tickets" | "office" | "artifacts" | "schedules";

const TABS = [
  { id: "tickets", label: "Notion Tickets", icon: ClipboardList, summary: "Notion task tracking" },
  { id: "office", label: "Office", icon: Building, summary: "Document processing" },
  { id: "artifacts", label: "Artifacts", icon: Layers, summary: "Saved files and assets" },
  { id: "schedules", label: "Schedules", icon: Timer, summary: "Automation cron jobs" }
];

interface WorkspaceProps {
  profile: string;
  visible: boolean;
}

export default function Workspace({ profile, visible }: WorkspaceProps): React.JSX.Element {
  const [active, setActive] = useState<WorkspaceTab>("tickets");

  return (
    <div className="self-container" style={{ display: visible ? "flex" : "none", flexDirection: "column", height: "100%", width: "100%" }}>
      <header className="self-header">
        <div>
          <div className="self-kicker">Workspace</div>
          <h1>Workspace</h1>
          <p>Productivity, document processing, and task automation.</p>
        </div>
      </header>
      <nav className="self-tool-tabs">
        {TABS.map(({ id, label, icon: Icon, summary }) => (
          <button
            key={id}
            className={active === id ? "active" : ""}
            onClick={() => setActive(id as WorkspaceTab)}
          >
            <Icon size={15} />
            <span>{label}</span>
            <small>{summary}</small>
          </button>
        ))}
      </nav>
      
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: active === "tickets" ? "flex" : "none", flex: 1, overflow: "hidden" }}>
          <NotionTickets profile={profile} />
        </div>
        <div style={{ display: active === "office" ? "flex" : "none", flex: 1, overflow: "hidden" }}>
          <Office profile={profile} visible={visible && active === "office"} />
        </div>
        <div style={{ display: active === "artifacts" ? "flex" : "none", flex: 1, overflow: "hidden" }}>
          <Artifacts profile={profile} />
        </div>
        <div style={{ display: active === "schedules" ? "flex" : "none", flex: 1, overflow: "hidden" }}>
          <Schedules profile={profile} />
        </div>
      </div>
    </div>
  );
}

