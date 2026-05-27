import { useState, useCallback, useEffect, useMemo } from "react";
import Chat, { ChatMessage } from "../Chat/Chat";
import {
  dbItemsToChatMessages,
  type DbHistoryItem,
} from "../Chat/sessionHistory";
import MissionControl from "../MissionControl/MissionControl";
import Sessions from "../Sessions/Sessions";
import Agents from "../Agents/Agents";
import Settings from "../Settings/Settings";
import Skills from "../Skills/Skills";

import Memory from "../Memory/Memory";
import Tools from "../Tools/Tools";
import Gateway from "../Gateway/Gateway";
import Office from "../Office/Office";
import Models from "../Models/Models";
import Providers from "../Providers/Providers";
import Schedules from "../Schedules/Schedules";
import Kanban from "../Kanban/Kanban";
import RemoteNotice from "../../components/RemoteNotice";
import VerifyWarningBanner from "../../components/VerifyWarningBanner";
import hermesBanner from "../../assets/hermes-banner.jpg";
import {
  ChatBubble,
  Clock,
  Users,
  Settings as SettingsIcon,
  Brain,
  Wrench,
  Signal,
  Building,
  Monitor,
  KeyRound,
  Timer,
  Kanban as KanbanIcon,
  Download,
  Plus,
  Pin,
  X,
} from "../../assets/icons";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../components/useI18n";

// ─── Pinned-tab persistence ────────────────────────────────────────────────
const PINNED_TABS_KEY = "hermes-pinned-tabs";

interface PinnedTabEntry {
  sessionId: string;
  title: string;
}

function loadPinnedTabs(): PinnedTabEntry[] {
  try {
    const raw = localStorage.getItem(PINNED_TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PinnedTabEntry =>
        e && typeof e.sessionId === "string" && typeof e.title === "string",
    );
  } catch {
    return [];
  }
}

function savePinnedTabs(conversations: ConversationState[]): void {
  const entries: PinnedTabEntry[] = conversations
    .filter((c) => c.pinned && c.sessionId)
    .map((c) => ({ sessionId: c.sessionId!, title: c.title }));
  try {
    localStorage.setItem(PINNED_TABS_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable (private mode, quota) — silently ignore
  }
}

type View =
  | "mission-control"
  | "chat"
  | "sessions"
  | "agents"
  | "office"
  | "providers"
  | "memory"
  | "tools"
  | "schedules"
  | "kanban"
  | "gateway"
  | "settings";

const NAV_ITEMS: { view: View; icon: LucideIcon; labelKey: string }[] = [
  {
    view: "mission-control",
    icon: Monitor,
    labelKey: "navigation.missionControl",
  },
  { view: "chat", icon: ChatBubble, labelKey: "navigation.chat" },
  { view: "sessions", icon: Clock, labelKey: "navigation.sessions" },
  { view: "agents", icon: Users, labelKey: "navigation.agents" },
  { view: "office", icon: Building, labelKey: "navigation.office" },
  { view: "kanban", icon: KanbanIcon, labelKey: "navigation.kanban" },
  { view: "providers", icon: KeyRound, labelKey: "navigation.providers" },
  { view: "memory", icon: Brain, labelKey: "navigation.memory" },
  { view: "tools", icon: Wrench, labelKey: "navigation.toolkit" },
  { view: "schedules", icon: Timer, labelKey: "navigation.schedules" },
  { view: "gateway", icon: Signal, labelKey: "navigation.gateway" },
  { view: "settings", icon: SettingsIcon, labelKey: "navigation.settings" },
];

interface LayoutProps {
  verifyWarning?: boolean;
  onReinstall?: () => void;
  onDismissVerifyWarning?: () => void;
}

interface ConversationState {
  id: string;
  title: string;
  sessionId: string | null;
  messages: ChatMessage[];
  pinned: boolean;
}

function createConversation(
  partial: Partial<ConversationState> = {},
): ConversationState {
  return {
    id:
      partial.id ||
      `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: partial.title || "New chat",
    sessionId: partial.sessionId ?? null,
    messages: partial.messages || [],
    pinned: partial.pinned ?? false,
  };
}

function titleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages
    .find(
      (m): m is ChatMessage & { content: string } =>
        m.role === "user" && "content" in m && typeof m.content === "string",
    )
    ?.content.trim();
  if (!firstUser) return "New chat";
  return firstUser.replace(/\s+/g, " ").slice(0, 42);
}

function Layout({
  verifyWarning,
  onReinstall,
  onDismissVerifyWarning,
}: LayoutProps = {}): React.JSX.Element {
  const { t } = useI18n();
  const [view, setView] = useState<View>("chat");
  const [conversations, setConversations] = useState<ConversationState[]>(() => {
    // Restore pinned tabs from localStorage as skeleton conversations.
    // Their messages will be hydrated in the useEffect below.
    const pinned = loadPinnedTabs().map((entry) =>
      createConversation({
        title: entry.title,
        sessionId: entry.sessionId,
        pinned: true,
      }),
    );
    const fresh = createConversation();
    return pinned.length > 0 ? [...pinned, fresh] : [fresh];
  });
  const [activeConversationId, setActiveConversationId] = useState<string>(
    () => {
      // Default to the first non-pinned (fresh) conversation
      const unpinned = conversations.find((c) => !c.pinned);
      return unpinned ? unpinned.id : conversations[0].id;
    },
  );
  const [activeProfile, setActiveProfile] = useState("default");
  // Tabs lazy-mount on first visit, then stay mounted (display:none toggle).
  // Keeps IPC refetch / DOM rebuild off the tab-switch hot path.
  const [visitedViews, setVisitedViews] = useState<Set<View>>(
    () => new Set<View>(["chat"]),
  );
  // Remote-only mode — SSH tunnel has full access; only pure HTTP remote mode restricts screens
  const [remoteMode, setRemoteMode] = useState(false);

  const paneStyle = (target: View): React.CSSProperties => ({
    display: view === target ? "flex" : "none",
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
  });

  const goTo = useCallback((v: View) => {
    setVisitedViews((prev) => (prev.has(v) ? prev : new Set(prev).add(v)));
    setView(v);
  }, []);

  // Re-check remote mode on tab switch (picks up Settings changes)
  useEffect(() => {
    window.hermesAPI.isRemoteOnlyMode().then(setRemoteMode);
  }, [view]);

  // Auto-update state
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<
    "available" | "downloading" | "ready" | "error" | null
  >(null);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const cleanupAvailable = window.hermesAPI.onUpdateAvailable((info) => {
      setUpdateVersion(info.version);
      setUpdateState("available");
      setUpdateError(null);
      setDownloadPercent(0);
    });
    const cleanupProgress = window.hermesAPI.onUpdateDownloadProgress(
      (info) => {
        setDownloadPercent(info.percent);
      },
    );
    const cleanupDownloaded = window.hermesAPI.onUpdateDownloaded(() => {
      setUpdateState("ready");
      setUpdateError(null);
    });
    const cleanupError = window.hermesAPI.onUpdateError((message) => {
      setUpdateState("error");
      setUpdateError(message);
      setDownloadPercent(0);
    });
    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  async function handleUpdate(): Promise<void> {
    if (updateState === "available" || updateState === "error") {
      setUpdateError(null);
      setDownloadPercent(0);
      setUpdateState("downloading");
      try {
        const ok = await window.hermesAPI.downloadUpdate();
        if (!ok) setUpdateState("error");
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : String(err));
        setUpdateState("error");
      }
    } else if (updateState === "ready") {
      await window.hermesAPI.installUpdate();
    }
  }

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ||
    conversations[0];
  const currentSessionId = activeConversation?.sessionId ?? null;
  const visibleConversations = useMemo(
    () =>
      conversations
        .map((conversation, index) => ({ conversation, index }))
        .sort((a, b) => {
          if (a.conversation.pinned !== b.conversation.pinned) {
            return a.conversation.pinned ? -1 : 1;
          }
          return a.index - b.index;
        })
        .map(({ conversation }) => conversation),
    [conversations],
  );

  const setActiveMessages = useCallback(
    (update: React.SetStateAction<ChatMessage[]>) => {
      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== activeConversationId) return conversation;
          const nextMessages =
            typeof update === "function"
              ? update(conversation.messages)
              : update;
          return {
            ...conversation,
            messages: nextMessages,
            title:
              conversation.sessionId || conversation.title !== "New chat"
                ? conversation.title
                : titleFromMessages(nextMessages),
          };
        }),
      );
    },
    [activeConversationId],
  );

  const updateActiveSessionId = useCallback(
    (sessionId: string) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                sessionId,
                title:
                  conversation.title === "New chat"
                    ? `Session ${sessionId.slice(-6)}`
                    : conversation.title,
              }
            : conversation,
        ),
      );
    },
    [activeConversationId],
  );

  const handleNewChat = useCallback(() => {
    const conversation = createConversation();
    setConversations((prev) => [...prev, conversation]);
    setActiveConversationId(conversation.id);
    goTo("chat");
  }, [goTo]);

  const handleCloseConversation = useCallback(
    (conversationId: string) => {
      setConversations((prev) => {
        const closing = prev.find((c) => c.id === conversationId);
        if (closing?.pinned) return prev;
        if (closing) void window.hermesAPI.abortChat(closing.id);
        const next = prev.filter((c) => c.id !== conversationId);
        if (next.length === 0) {
          const replacement = createConversation();
          setActiveConversationId(replacement.id);
          return [replacement];
        }
        if (conversationId === activeConversationId) {
          setActiveConversationId(next[next.length - 1].id);
        }
        savePinnedTabs(next);
        return next;
      });
    },
    [activeConversationId],
  );

  const handleTogglePinnedConversation = useCallback(
    (conversationId: string) => {
      setConversations((prev) => {
        const next = prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, pinned: !conversation.pinned }
            : conversation,
        );
        savePinnedTabs(next);
        return next;
      });
    },
    [],
  );

  // Hydrate pinned-tab messages from session store on first mount
  useEffect(() => {
    let cancelled = false;
    const pinnedWithSessions = conversations.filter(
      (c) => c.pinned && c.sessionId && c.messages.length === 0,
    );
    if (pinnedWithSessions.length === 0) return;

    Promise.all(
      pinnedWithSessions.map(async (c) => {
        const items = await window.hermesAPI.getSessionMessages(
          c.sessionId!,
          activeProfile,
        );
        return { id: c.id, items };
      }),
    ).then((results) => {
      if (cancelled) return;
      setConversations((prev) =>
        prev.map((conversation) => {
          const match = results.find((r) => r.id === conversation.id);
          if (!match || match.items.length === 0) return conversation;
          const chatMessages: ChatMessage[] = match.items
            .map((it): ChatMessage | null => {
              switch (it.kind) {
                case "user":
                  return {
                    id: `db-${it.id}`,
                    role: "user",
                    content: it.content,
                    ...(it.attachments && it.attachments.length > 0
                      ? { attachments: it.attachments }
                      : {}),
                  };
                case "assistant":
                  return {
                    id: `db-${it.id}`,
                    role: "agent",
                    content: it.content,
                    ...(it.attachments && it.attachments.length > 0
                      ? { attachments: it.attachments }
                      : {}),
                  };
                case "reasoning":
                  return {
                    id: `db-r-${it.id}`,
                    kind: "reasoning",
                    role: "agent",
                    text: it.text,
                  };
                case "tool_call":
                  return {
                    id: `db-tc-${it.id}-${it.callId || "x"}`,
                    kind: "tool_call",
                    role: "agent",
                    callId: it.callId,
                    name: it.name,
                    args: it.args,
                  };
                case "tool_result":
                  return {
                    id: `db-tr-${it.id}`,
                    kind: "tool_result",
                    role: "agent",
                    callId: it.callId,
                    name: it.name,
                    content: it.content,
                    ...(it.attachments && it.attachments.length > 0
                      ? { attachments: it.attachments }
                      : {}),
                  };
                default:
                  return null;
              }
            })
            .filter((m): m is ChatMessage => m !== null);
          return { ...conversation, messages: chatMessages };
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- one-time hydration on mount

  // Listen for menu IPC events (Cmd+N, Cmd+K from app menu)
  useEffect(() => {
    const cleanupNewChat = window.hermesAPI.onMenuNewChat(() => {
      handleNewChat();
    });
    const cleanupSearch = window.hermesAPI.onMenuSearchSessions(() => {
      goTo("sessions");
    });
    return () => {
      cleanupNewChat();
      cleanupSearch();
    };
  }, [handleNewChat, goTo]);

  const handleSelectProfile = useCallback((name: string) => {
    setActiveProfile(name);
    const conversation = createConversation();
    setConversations([conversation]);
    setActiveConversationId(conversation.id);
  }, []);

  const handleResumeSession = useCallback(
    async (sessionId: string) => {
      const items = (await window.hermesAPI.getSessionMessages(
        sessionId,
        activeProfile,
      )) as DbHistoryItem[];
      const chatMessages = dbItemsToChatMessages(items);
      const existing = conversations.find((c) => c.sessionId === sessionId);
      if (existing) {
        setActiveConversationId(existing.id);
      } else {
        const conversation = createConversation({
          title: `Session ${sessionId.slice(-6)}`,
          sessionId,
          messages: chatMessages,
        });
        setConversations((prev) => [...prev, conversation]);
        setActiveConversationId(conversation.id);
      }
      goTo("chat");
    },
    [activeProfile, conversations, goTo],
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={hermesBanner} height={42} alt="Hermes OS" style={{ borderRadius: 6 }} />
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ view: v, icon: Icon, labelKey }) => (
            <button
              key={v}
              className={`sidebar-nav-item ${view === v ? "active" : ""}`}
              onClick={() => goTo(v)}
            >
              <Icon size={16} />
              {t(labelKey)}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {updateState && (
            <button
              className={`sidebar-update-btn ${
                updateState === "error" ? "error" : ""
              }`}
              onClick={handleUpdate}
              disabled={updateState === "downloading"}
              title={updateError ?? undefined}
            >
              <Download size={13} />
              {updateState === "available" && (
                <span>
                  {t("common.updateAvailable", { version: updateVersion })}
                </span>
              )}
              {updateState === "downloading" && (
                <span>
                  {t("common.downloading", { percent: downloadPercent })}
                </span>
              )}
              {updateState === "ready" && (
                <span>{t("common.restartToUpdate")}</span>
              )}
              {updateState === "error" && (
                <span>{t("common.updateFailed")}</span>
              )}
            </button>
          )}
          <div className="sidebar-footer-text">
            {activeProfile === "default" ? t("common.appName") : activeProfile}
          </div>
        </div>
      </aside>

      <main className="content">
        {verifyWarning && onReinstall && onDismissVerifyWarning && (
          <VerifyWarningBanner
            onReinstall={onReinstall}
            onDismiss={onDismissVerifyWarning}
          />
        )}
        <div style={paneStyle("mission-control")}>
          <MissionControl onNavigate={goTo} visible={view === "mission-control"} />
        </div>
        <div style={paneStyle("chat")}>
          <div className="conversation-tabs">
            {visibleConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-tab${
                  conversation.id === activeConversationId ? " active" : ""
                }${conversation.pinned ? " pinned" : ""}`}
                title={
                  conversation.pinned
                    ? `${conversation.title} (pinned)`
                    : conversation.title
                }
              >
                <button
                  className="conversation-tab-pin"
                  aria-pressed={conversation.pinned}
                  aria-label={
                    conversation.pinned ? "Unpin chat tab" : "Pin chat tab"
                  }
                  title={conversation.pinned ? "Unpin chat tab" : "Pin chat tab"}
                  type="button"
                  onClick={() => {
                    handleTogglePinnedConversation(conversation.id);
                  }}
                >
                  <Pin size={11} />
                </button>
                <button
                  className="conversation-tab-label"
                  type="button"
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  {conversation.title}
                </button>
                {conversations.length > 1 && !conversation.pinned && (
                  <button
                    className="conversation-tab-close"
                    type="button"
                    aria-label="Close chat tab"
                    title="Close chat tab"
                    onClick={() => {
                      handleCloseConversation(conversation.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <button
              className="conversation-tab conversation-tab-add"
              onClick={handleNewChat}
              title="New chat"
            >
              <Plus size={14} />
            </button>
          </div>
          <Chat
            key={activeConversation.id}
            requestId={activeConversation.id}
            messages={activeConversation.messages}
            setMessages={setActiveMessages}
            sessionId={activeConversation.sessionId}
            profile={activeProfile}
            onSessionIdChange={updateActiveSessionId}
            onNewChat={handleNewChat}
          />
        </div>

        {visitedViews.has("sessions") && (
          <div style={paneStyle("sessions")}>
            {remoteMode ? (
              <RemoteNotice feature="Sessions" />
            ) : (
              <Sessions
                onResumeSession={handleResumeSession}
                onNewChat={handleNewChat}
                currentSessionId={currentSessionId}
                profile={activeProfile}
                visible={view === "sessions"}
              />
            )}
          </div>
        )}

        {visitedViews.has("agents") && (
          <div style={paneStyle("agents")}>
            {remoteMode ? (
              <RemoteNotice feature="Profiles" />
            ) : (
              <Agents
                activeProfile={activeProfile}
                onSelectProfile={handleSelectProfile}
                onChatWith={(name: string) => {
                  handleSelectProfile(name);
                  goTo("chat");
                }}
              />
            )}
          </div>
        )}

        {visitedViews.has("office") && (
          <div style={paneStyle("office")}>
            <Office profile={activeProfile} visible={view === "office"} />
          </div>
        )}

        {visitedViews.has("providers") && (
          <div style={paneStyle("providers")}>
            {remoteMode ? (
              <RemoteNotice feature="Providers" />
            ) : (
              <>
                <Providers
                  profile={activeProfile}
                  visible={view === "providers"}
                />
                <Models visible={view === "providers"} />
              </>
            )}
          </div>
        )}



        {visitedViews.has("memory") && (
          <div style={paneStyle("memory")}>
            {remoteMode ? (
              <RemoteNotice feature="Memory" />
            ) : (
              <Memory profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("tools") && (
          <div style={paneStyle("tools")}>
            {remoteMode ? (
              <RemoteNotice feature="Toolkit" />
            ) : (
              <div className="toolkit-pane">
                <Tools profile={activeProfile} />
                <div className="toolkit-divider" />
                <Skills profile={activeProfile} />
              </div>
            )}
          </div>
        )}

        {visitedViews.has("schedules") && (
          <div style={paneStyle("schedules")}>
            <Schedules profile={activeProfile} />
          </div>
        )}

        {visitedViews.has("kanban") && (
          <div style={paneStyle("kanban")}>
            {remoteMode ? (
              <RemoteNotice feature="Kanban" />
            ) : (
              <Kanban profile={activeProfile} visible={view === "kanban"} />
            )}
          </div>
        )}

        {visitedViews.has("gateway") && (
          <div style={paneStyle("gateway")}>
            {remoteMode ? (
              <RemoteNotice feature="Gateway" />
            ) : (
              <Gateway profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("settings") && (
          <div style={paneStyle("settings")}>
            <Settings profile={activeProfile} />
          </div>
        )}
      </main>
    </div>
  );
}

export default Layout;
