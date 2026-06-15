import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Brain,
  ChatBubble,
  Check,
  Clock,
  KeyRound,
  Kanban as KanbanIcon,
  LayoutDashboard,
  Refresh,
  Sparkles,
  Timer,
  Users,
  Wrench,
} from "../../assets/icons";
import type { LucideIcon } from "lucide-react";
import Memory from "../Memory/Memory";

type MissionControlStatus = Awaited<
  ReturnType<Window["hermesAPI"]["missionControlGetStatus"]>
>;
type Status = MissionControlStatus["subsystems"][number]["state"];
type MissionMode = "chat" | "goal" | "kanban" | "workspace" | "control";
type MissionDestination =
  | "chat"
  | "sessions"
  | "kanban"
  | "agents"
  | "providers"
  | "tools"
  | "settings";

interface MissionControlProps {
  onNavigate?: (view: MissionDestination) => void;
  onChatWith?: (profileName: string) => void;
  visible?: boolean;
  profile?: string;
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
  { id: "control", label: "Control Room", icon: LayoutDashboard },
  { id: "chat", label: "Chat", icon: ChatBubble },
  { id: "goal", label: "Goals", icon: Sparkles },
  { id: "kanban", label: "Kanban", icon: KanbanIcon },
  { id: "workspace", label: "Workspace", icon: Brain },
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

function KanbanChart({
  counts = {},
}: {
  counts?: Record<string, number>;
}): React.JSX.Element {
  const statuses = ["done", "running", "blocked", "ready", "todo", "triage"];
  const colors: Record<string, string> = {
    done: "var(--success)",
    running: "var(--accent-text)",
    blocked: "var(--jewel-ruby)",
    ready: "var(--jewel-gold)",
    todo: "var(--jewel-amethyst)",
    triage: "var(--text-muted)",
  };

  const labels: Record<string, string> = {
    done: "Completed",
    running: "Running",
    blocked: "Blocked",
    ready: "Ready",
    todo: "Todo",
    triage: "Triage",
  };

  const data = statuses.map((status) => ({
    status,
    count: counts[status] ?? 0,
    color: colors[status],
    label: labels[status],
  }));

  const total = data.reduce((acc, curr) => acc + curr.count, 0);

  if (total === 0) {
    return (
      <div className="mission-kanban-chart-wrapper">
        <div className="mission-kanban-chart-svg">
          <svg width="160" height="160" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="70"
              fill="transparent"
              stroke="var(--bg-tertiary)"
              strokeWidth="16"
            />
            <text
              x="100"
              y="95"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text-primary)"
              fontSize="24"
              fontWeight="bold"
            >
              0
            </text>
            <text
              x="100"
              y="118"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize="10"
              letterSpacing="0.1em"
              fontWeight="600"
            >
              TASKS
            </text>
          </svg>
        </div>
        <div className="mission-kanban-legend">
          <div className="mission-empty-legend">No tasks on this board</div>
        </div>
      </div>
    );
  }

  const r = 70;
  const circ = 2 * Math.PI * r;
  let accumulatedCount = 0;

  return (
    <div className="mission-kanban-chart-wrapper">
      <div className="mission-kanban-chart-svg">
        <svg width="160" height="160" viewBox="0 0 200 200">
          {data.map((item) => {
            if (item.count === 0) return null;
            const strokeLength = (item.count / total) * circ;
            const strokeOffset = (accumulatedCount / total) * circ;
            accumulatedCount += item.count;

            return (
              <circle
                key={item.status}
                cx="100"
                cy="100"
                r={r}
                fill="transparent"
                stroke={item.color}
                strokeWidth="16"
                strokeDasharray={`${strokeLength} ${circ}`}
                strokeDashoffset={-strokeOffset}
                transform="rotate(-90 100 100)"
                style={{ transition: "stroke-dashoffset 0.3s ease" }}
              />
            );
          })}
          <text
            x="100"
            y="95"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-primary)"
            fontSize="24"
            fontWeight="bold"
          >
            {total}
          </text>
          <text
            x="100"
            y="118"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-muted)"
            fontSize="10"
            letterSpacing="0.1em"
            fontWeight="600"
          >
            TOTAL TASKS
          </text>
        </svg>
      </div>

      <div className="mission-kanban-legend">
        {data.map((item) => {
          const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div
              key={item.status}
              className={`mission-legend-item ${item.count === 0 ? "muted" : ""}`}
            >
              <div className="mission-legend-label">
                <span
                  className="mission-legend-color"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
              <div className="mission-legend-value">
                <strong>{item.count}</strong>
                {item.count > 0 && (
                  <span className="mission-legend-pct">{percentage}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
type ControlTab = "system" | "journal" | "vault-memory" | "daily-review";

const CONTROL_TABS: Array<{
  id: ControlTab;
  label: string;
  icon: LucideIcon;
  summary: string;
}> = [
  {
    id: "system",
    label: "System Status",
    icon: LayoutDashboard,
    summary: "Subsystems, teams, and credentials.",
  },
  {
    id: "journal",
    label: "Journal",
    icon: Clock,
    summary: "Daily notes for Obsidian vault.",
  },
  {
    id: "vault-memory",
    label: "Vault Memory",
    icon: Brain,
    summary: "Hermes memory and recall.",
  },
  {
    id: "daily-review",
    label: "Daily Review",
    icon: Timer,
    summary: "Compact operating check.",
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
    <section className="self-panel" style={{ width: "100%", boxSizing: "border-box" }}>
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
function MissionControl({
  onNavigate,
  onChatWith,
  visible = true,
  profile,
}: MissionControlProps): React.JSX.Element {
  const [status, setStatus] = useState<MissionControlStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MissionMode>("control");
  const [controlTab, setControlTab] = useState<ControlTab>("system");
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
        <div className="mission-goal-layout mission-goal-layout-single">
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
                    <span className="mission-director-list">
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
                          <button
                            className="mission-director-chat-btn"
                            onClick={() => onChatWith?.(d)}
                            title={`Chat with ${d}`}
                            type="button"
                          >
                            Chat
                          </button>
                        </React.Fragment>
                      ))}
                      <span className="mission-director-separator">
                        {" "}&mdash;{" "}
                      </span>
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
        </div>
      )}

      {mode === "kanban" && (
        <div className="mission-kanban-layout">
          <Panel
            kicker="Board Overview"
            title="Task Distribution"
            action={
              <button
                className="mission-link-button"
                onClick={() => go("kanban")}
              >
                Open Kanban
              </button>
            }
          >
            <KanbanChart counts={status?.kanban?.counts} />
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
                <Wrench size={15} />
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
        <div className="mission-control-container" style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
          <nav className="self-tool-tabs" aria-label="Control Room tools">
            {CONTROL_TABS.map(({ id, label, icon: Icon, summary }) => (
              <button
                key={id}
                className={controlTab === id ? "active" : ""}
                type="button"
                onClick={() => setControlTab(id)}
              >
                <Icon size={15} />
                <span>{label}</span>
                <small>{summary}</small>
              </button>
            ))}
          </nav>

          {controlTab === "system" && (
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
                        <span className="mission-director-list">
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
                              <button
                                className="mission-director-chat-btn"
                                onClick={() => onChatWith?.(d)}
                                title={`Chat with ${d}`}
                                type="button"
                              >
                                Chat
                              </button>
                            </React.Fragment>
                          ))}
                          <span className="mission-director-separator">
                            {" "}&mdash;{" "}
                          </span>
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

          {controlTab === "journal" && (
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

          {controlTab === "vault-memory" && (
            <div className="self-memory-pane" style={{ border: "1px solid var(--panel-border)", borderRadius: "var(--radius-md)" }}>
              <Memory profile={profile} />
            </div>
          )}

          {controlTab === "daily-review" && (
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
      )}
    </div>
  );
}

export default MissionControl;
