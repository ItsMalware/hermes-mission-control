import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Brain,
  ChatBubble,
  Clock,
  KeyRound,
  Kanban as KanbanIcon,
  LayoutDashboard,
  Refresh,
  Sparkles,
  Users,
} from "../../assets/icons";
import type { LucideIcon } from "lucide-react";

type MissionControlStatus = Awaited<
  ReturnType<Window["hermesAPI"]["missionControlGetStatus"]>
>;
type Status = MissionControlStatus["subsystems"][number]["state"];
type MissionMode = "chat" | "goal" | "workspace" | "control";
type MissionDestination =
  | "chat"
  | "sessions"
  | "kanban"
  | "agents"
  | "providers"
  | "memory"
  | "tools"
  | "settings";

interface MissionControlProps {
  onNavigate?: (view: MissionDestination) => void;
  onChatWith?: (profileName: string) => void;
  visible?: boolean;
}

const statusLabels: Record<Status, string> = {
  LIVE: "Live",
  BUSY: "Busy",
  DEGRADED: "Review",
  OFFLINE: "Offline",
  UNKNOWN: "Unknown",
};

const modeItems: Array<{
  id: MissionMode;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "chat", label: "Chat", icon: ChatBubble },
  { id: "goal", label: "Goals", icon: Sparkles },
  { id: "workspace", label: "Workspace", icon: Brain },
  { id: "control", label: "Control Room", icon: LayoutDashboard },
];

function StatusPill({ state }: { state: Status }): React.JSX.Element {
  return (
    <span className={`mission-status-pill mission-status-${state.toLowerCase()}`}>
      {statusLabels[state]}
    </span>
  );
}

function Panel({
  title,
  kicker,
  action,
  children,
}: {
  title: string;
  kicker?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="mission-panel">
      <div className="mission-panel-title">
        <div>
          {kicker && <span>{kicker}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function fmtTime(value: number): string {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function localTime(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function MissionControl({
  onNavigate,
  onChatWith,
  visible = true,
}: MissionControlProps): React.JSX.Element {
  const [status, setStatus] = useState<MissionControlStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MissionMode>("workspace");
  const prevVisible = useRef(false);

  async function loadStatus(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setStatus(await window.hermesAPI.missionControlGetStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // Re-fetch every time the tab becomes visible
  useEffect(() => {
    if (visible && !prevVisible.current) {
      void loadStatus();
    }
    prevVisible.current = visible;
  }, [visible]);

  const systemTotals = useMemo(() => {
    const subsystems = status?.subsystems ?? [];
    return {
      live: subsystems.filter((item) => item.state === "LIVE").length,
      review: subsystems.filter(
        (item) => item.state === "DEGRADED" || item.state === "OFFLINE",
      ).length,
      total: subsystems.length,
    };
  }, [status]);

  const topSubsystems = (status?.subsystems ?? []).slice(0, 7);

  // Active API keys from the secrets inventory (present OR duplicate = key exists)
  const activeKeys = useMemo(() => {
    return (status?.secrets.items ?? []).filter((s) => s.status !== "missing");
  }, [status]);

  function go(destination: MissionDestination): void {
    onNavigate?.(destination);
  }

  return (
    <div className="mission-control">
      <header className="mission-hero">
        <div>
          <div className="mission-eyebrow">
            <span>IV.</span>
            <i />
            <strong>Hermes OS</strong>
          </div>
          <h1>Hermes OS</h1>
          <p>
            Nous Research agent. Sessions, skills, kanban, profiles, and a chat
            line.
          </p>
          <div className="mission-local-time">
            <span>{localTime()}</span>
            <strong>Local</strong>
            <strong>Lab</strong>
          </div>
        </div>
        <div className="mission-hero-actions">
          <button
            className="mission-command"
            type="button"
            onClick={() => go("chat")}
          >
            <ChatBubble size={14} />
            Chat
          </button>
          <button
            className="mission-command"
            type="button"
            onClick={() => setMode("control")}
          >
            <span className="mission-bars" />
            All systems
          </button>
        </div>
      </header>

      <nav className="mission-mode-tabs" aria-label="Mission Control modes">
        {modeItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={mode === id ? "active" : ""}
            type="button"
            onClick={() => setMode(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mission-error">
          <Alert size={16} />
          <span>{error}</span>
        </div>
      )}

      {mode === "chat" && (
        <div className="mission-focus-grid">
          <Panel
            kicker="Hermes - Chat"
            title="Start or resume a conversation."
            action={
              <button className="mission-link-button" onClick={() => go("chat")}>
                Open chat
              </button>
            }
          >
            <div className="mission-callout">
              <ChatBubble size={26} />
              <div>
                <strong>Chat line is request-scoped.</strong>
                <span>
                  Multiple tabs stay isolated while Hermes streams back.
                </span>
              </div>
            </div>
          </Panel>
          <Panel
            kicker={`Sessions - ${status?.sessions.totalCached ?? 0}`}
            title="Recent sessions"
          >
            <div className="mission-list">
              {(status?.sessions.latest ?? []).slice(0, 5).map((session) => (
                <button
                  className="mission-row mission-row-button"
                  key={session.id}
                  type="button"
                  onClick={() => go("sessions")}
                >
                  <div>
                    <strong>{session.title}</strong>
                    <span>
                      {session.messageCount} messages -{" "}
                      {session.model || "model unknown"}
                    </span>
                  </div>
                  <time>{fmtTime(session.startedAt * 1000)}</time>
                </button>
              ))}
              {status?.sessions.latest.length === 0 && (
                <div className="mission-empty">No cached sessions indexed.</div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {mode === "goal" && (
        <div className="mission-goal-layout">
          <Panel
            kicker={`Teams - ${status?.teams.length ?? 0}`}
            title="Team goals & objectives"
            action={
              <button
                className="mission-link-button"
                onClick={() => go("agents")}
              >
                Open teams
              </button>
            }
          >
            <div className="mission-list">
              {(status?.teams ?? []).map((team) => (
                <div className="mission-row mission-team-row" key={team.key}>
                  <div>
                    <strong>{team.label}</strong>
                    {team.goal ? (
                      <span className="mission-team-goal">{team.goal}</span>
                    ) : (
                      <span className="mission-team-goal mission-text-muted">
                        No goal set
                      </span>
                    )}
                    <span>
                      {team.directors.map((d, i) => (
                        <React.Fragment key={d}>
                          {i > 0 && ", "}
                          <span
                            className="mission-director-link"
                            onDoubleClick={() => onChatWith?.(d)}
                            title="Double-click to chat"
                          >
                            {d}
                          </span>
                        </React.Fragment>
                      ))}
                      {" "}&mdash;{" "}
                      {team.members > 0
                        ? `${team.members} workers`
                        : "No workers"}
                    </span>
                  </div>
                  <StatusPill state={team.state} />
                </div>
              ))}
              {(status?.teams ?? []).length === 0 && (
                <div className="mission-empty">
                  No teams found. Create director profiles to define teams.
                </div>
              )}
            </div>
          </Panel>
          <Panel
            kicker={`Kanban - ${status?.kanban.boardCount ?? 0} boards`}
            title="Top actionable items"
            action={
              <button
                className="mission-link-button"
                onClick={() => go("kanban")}
              >
                Open Kanban
              </button>
            }
          >
            <div className="mission-list">
              {(status?.kanban.topItems ?? []).slice(0, 5).map((task) => (
                <div className="mission-row" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>
                      Priority {task.priority}
                      {task.assignee ? ` - ${task.assignee}` : ""}
                    </span>
                  </div>
                  <em>{task.status}</em>
                </div>
              ))}
              {status?.kanban.topItems.length === 0 && (
                <div className="mission-empty">No actionable Kanban items.</div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {mode === "workspace" && (
        <div className="mission-workspace">
          <Panel kicker="Quick launch" title="Workspace map">
            <div className="mission-bucket-grid">
              <button onClick={() => go("chat")}>
                <ChatBubble size={15} />
                <strong>Chat</strong>
                <span>New conversation</span>
              </button>
              <button onClick={() => go("sessions")}>
                <Clock size={15} />
                <strong>Sessions</strong>
                <span>{status?.sessions.totalCached ?? 0} cached</span>
              </button>
              <button onClick={() => go("kanban")}>
                <KanbanIcon size={15} />
                <strong>Kanban</strong>
                <span>{status?.kanban.boardCount ?? 0} boards</span>
              </button>
              <button onClick={() => go("agents")}>
                <Users size={15} />
                <strong>Teams</strong>
                <span>{status?.teams.length ?? 0} teams</span>
              </button>
              <button onClick={() => go("providers")}>
                <KeyRound size={15} />
                <strong>Providers</strong>
                <span>{activeKeys.length} keys active</span>
              </button>
              <button onClick={() => go("tools")}>
                <LayoutDashboard size={15} />
                <strong>Toolkit</strong>
                <span>Skills & tools</span>
              </button>
            </div>
          </Panel>
          <Panel kicker="At a glance" title="System overview">
            <div className="mission-glance">
              <div className="mission-glance-health">
                <span className={`mission-glance-dot ${systemTotals.review > 0 ? "warn" : "ok"}`} />
                <strong>
                  {systemTotals.review > 0
                    ? `${systemTotals.review} of ${systemTotals.total} systems need review`
                    : `All ${systemTotals.total} systems live`}
                </strong>
              </div>
              <div className="mission-glance-stats">
                <div>
                  <span>Connection</span>
                  <strong>{titleCase(status?.connection?.mode ?? "local")}</strong>
                </div>
                <div>
                  <span>Profiles</span>
                  <strong>{status?.profiles?.length ?? 0}</strong>
                </div>
                <div>
                  <span>Teams</span>
                  <strong>{status?.teams?.length ?? 0}</strong>
                </div>
                <div>
                  <span>Sessions</span>
                  <strong>{status?.sessions.totalCached ?? 0}</strong>
                </div>
              </div>
              {activeKeys.length > 0 && (
                <div className="mission-glance-keys">
                  <span className="mission-glance-keys-label">Active keys</span>
                  <div className="mission-glance-key-tags">
                    {activeKeys.map((k) => (
                      <span key={k.key} className="mission-key-tag">
                        {k.key.replace(/_API_KEY|_TOKEN/g, "").replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {mode === "control" && (
        <div className="mission-control-room">
          <Panel
            kicker={`${systemTotals.live}/${systemTotals.total} live`}
            title="System status"
            action={
              <button
                className="mission-link-button"
                onClick={() => void loadStatus()}
                disabled={loading}
              >
                <Refresh size={13} />
                {loading ? "Refreshing" : "Refresh"}
              </button>
            }
          >
            <div className="mission-list">
              {topSubsystems.map((subsystem) => (
                <div className="mission-row" key={subsystem.id}>
                  <div>
                    <strong>{subsystem.label}</strong>
                    <span>{subsystem.detail}</span>
                  </div>
                  <StatusPill state={subsystem.state} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            kicker={`Teams - ${(status?.teams ?? []).length}`}
            title="Agent teams"
            action={
              <button
                className="mission-link-button"
                onClick={() => go("agents")}
              >
                Open teams
              </button>
            }
          >
            <div className="mission-list">
              {(status?.teams ?? []).map((team) => (
                <div className="mission-row mission-team-row" key={team.key}>
                  <div>
                    <strong>{team.label}</strong>
                    {team.goal && (
                      <span className="mission-team-goal">{team.goal}</span>
                    )}
                    <span>
                      {team.directors.map((d, i) => (
                        <React.Fragment key={d}>
                          {i > 0 && ", "}
                          <span
                            className="mission-director-link"
                            onDoubleClick={() => onChatWith?.(d)}
                            title="Double-click to chat"
                          >
                            {d}
                          </span>
                        </React.Fragment>
                      ))}
                      {" "}&mdash;{" "}
                      {team.members > 0
                        ? `${team.members} workers`
                        : "No workers"}
                    </span>
                  </div>
                  <StatusPill state={team.state} />
                </div>
              ))}
              {(status?.teams ?? []).length === 0 && (
                <div className="mission-empty">No director teams found.</div>
              )}
            </div>
          </Panel>
          <Panel
            kicker={`Secrets - ${status?.secrets.total ?? 0}`}
            title="Credential inventory"
          >
            <div className="mission-secret-meter">
              <span>Present {status?.secrets.present ?? 0}</span>
              <span>Missing {status?.secrets.missing ?? 0}</span>
              <span>Duplicate {status?.secrets.duplicate ?? 0}</span>
            </div>
            <div className="mission-token-list">
              {(status?.secrets.items ?? []).slice(0, 8).map((secret) => (
                <div className="mission-token" key={secret.key}>
                  <span>{secret.key}</span>
                  <em>{secret.status}</em>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

export default MissionControl;
