import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Refresh,
  Bot,
  Check,
  Alert,
  Ban,
  Send,
  ExternalLink,
  Trash,
  ChatBubble,
} from "../../assets/icons";

interface AiCliInfo {
  id: string;
  name: string;
  command: string;
  installed: boolean;
  path: string | null;
  version: string | null;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  description: string;
  promptMode: boolean;
  error?: string;
}

interface AiCliRunResult {
  id: string;
  command: string;
  args: string[];
  output: string;
  exitCode: number | null;
  success: boolean;
  error?: string;
}

interface AiCliMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

function statusIcon(status: AiCliInfo["status"]): React.JSX.Element {
  if (status === "ONLINE") return <Check size={14} />;
  if (status === "DEGRADED") return <Alert size={14} />;
  return <Ban size={14} />;
}

function buildConversationPrompt(
  item: AiCliInfo,
  messages: AiCliMessage[],
): string {
  const transcript = messages
    .map((message) => {
      if (message.role === "user") return `User: ${message.content}`;
      if (message.role === "assistant") return `${item.name}: ${message.content}`;
      return `System: ${message.content}`;
    })
    .join("\n\n");

  return [
    `You are ${item.name} being used from Hermes OS.`,
    "Continue the conversation naturally. Use the prior transcript as context and answer the latest user message.",
    "",
    transcript,
  ].join("\n");
}

function newMessage(role: AiCliMessage["role"], content: string): AiCliMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
  };
}

function AiClis(): React.JSX.Element {
  const [items, setItems] = useState<AiCliInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [conversations, setConversations] = useState<
    Record<string, AiCliMessage[]>
  >({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [lastRuns, setLastRuns] = useState<Record<string, AiCliRunResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextItems = await window.hermesAPI.listAiClis();
      setItems(nextItems);
      setActiveId((current) =>
        current && nextItems.some((item) => item.id === current)
          ? current
          : nextItems[0]?.id || "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) || items[0] || null,
    [activeId, items],
  );
  const online = items.filter((item) => item.status === "ONLINE").length;
  const activeMessages = activeItem ? conversations[activeItem.id] || [] : [];

  async function sendMessage(item: AiCliInfo): Promise<void> {
    const text = (drafts[item.id] || "").trim();
    if (!text || running[item.id]) return;

    const previous = conversations[item.id] || [];
    const nextMessages = [...previous, newMessage("user", text)];
    setConversations((current) => ({
      ...current,
      [item.id]: nextMessages,
    }));
    setDrafts((current) => ({ ...current, [item.id]: "" }));
    setRunning((current) => ({ ...current, [item.id]: true }));

    try {
      const prompt = buildConversationPrompt(item, nextMessages);
      const result = await window.hermesAPI.runAiCliPrompt(item.id, prompt);
      setLastRuns((current) => ({ ...current, [item.id]: result }));
      setConversations((current) => ({
        ...current,
        [item.id]: [
          ...(current[item.id] || nextMessages),
          newMessage("assistant", result.output),
        ],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastRuns((current) => ({
        ...current,
        [item.id]: {
          id: item.id,
          command: item.command,
          args: [],
          output: message,
          exitCode: null,
          success: false,
          error: message,
        },
      }));
      setConversations((current) => ({
        ...current,
        [item.id]: [
          ...(current[item.id] || nextMessages),
          newMessage("system", message),
        ],
      }));
    } finally {
      setRunning((current) => ({ ...current, [item.id]: false }));
    }
  }

  async function openTerminal(item: AiCliInfo): Promise<void> {
    try {
      await window.hermesAPI.openAiCliTerminal(item.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setConversations((current) => ({
        ...current,
        [item.id]: [...(current[item.id] || []), newMessage("system", message)],
      }));
    }
  }

  function clearConversation(item: AiCliInfo): void {
    setConversations((current) => ({ ...current, [item.id]: [] }));
    setDrafts((current) => ({ ...current, [item.id]: "" }));
    setLastRuns((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  }

  return (
    <div className="ai-clis-container">
      <div className="ai-clis-header">
        <div>
          <div className="ai-clis-kicker">Local wrappers</div>
          <h1 className="ai-clis-title">AI CLIs</h1>
          <p className="ai-clis-subtitle">
            Keep separate conversations with each local AI wrapper, or open the
            CLI in Terminal when it needs a native interactive session.
          </p>
        </div>
        <button className="btn-ghost ai-clis-refresh" onClick={load}>
          <Refresh size={14} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="ai-clis-summary">
        <div>
          <span>{online}</span>
          <small>online</small>
        </div>
        <div>
          <span>{items.length - online}</span>
          <small>offline or degraded</small>
        </div>
      </div>

      {error && <div className="ai-clis-error">{error}</div>}

      <div className="ai-cli-workbench">
        <div className="ai-cli-tabs" role="tablist" aria-label="AI CLI tabs">
          {items.map((item) => (
            <button
              key={item.id}
              className={`ai-cli-tab ${activeItem?.id === item.id ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeItem?.id === item.id}
              onClick={() => setActiveId(item.id)}
            >
              <Bot size={15} />
              <span>{item.name}</span>
              <span className="ai-cli-status">
                {statusIcon(item.status)}
                {item.status}
              </span>
            </button>
          ))}
        </div>

        {activeItem ? (
          <section
            className={`ai-cli-conversation ai-cli-card--${activeItem.status.toLowerCase()}`}
          >
            <div className="ai-cli-conversation-header">
              <div className="ai-cli-card-header">
                <div className="ai-cli-avatar">
                  <Bot size={18} />
                </div>
                <div>
                  <h2>{activeItem.name}</h2>
                  <p>{activeItem.description}</p>
                </div>
                <span className="ai-cli-status">
                  {statusIcon(activeItem.status)}
                  {activeItem.status}
                </span>
              </div>

              <div className="ai-cli-actions">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => void openTerminal(activeItem)}
                  disabled={!activeItem.installed}
                  title={
                    activeItem.installed
                      ? `Open ${activeItem.command} in Terminal`
                      : "Install this CLI before opening it"
                  }
                >
                  <ExternalLink size={14} />
                  Terminal
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => clearConversation(activeItem)}
                  disabled={activeMessages.length === 0 && !drafts[activeItem.id]}
                >
                  <Trash size={14} />
                  Clear
                </button>
              </div>
            </div>

            <dl className="ai-cli-details ai-cli-details-row">
              <div>
                <dt>Command</dt>
                <dd>
                  <code>{activeItem.command}</code>
                </dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{activeItem.version || "Not available"}</dd>
              </div>
              <div>
                <dt>Path</dt>
                <dd>{activeItem.path || "Not found on PATH"}</dd>
              </div>
            </dl>

            {activeItem.error && (
              <pre className="ai-cli-error">{activeItem.error}</pre>
            )}

            <div className="ai-cli-chat">
              {activeMessages.length === 0 ? (
                <div className="ai-cli-chat-empty">
                  <ChatBubble size={18} />
                  <span>
                    {activeItem.promptMode
                      ? `Start a conversation with ${activeItem.name}.`
                      : `${activeItem.name} can be opened in Terminal, but Hermes does not know its chat prompt mode yet.`}
                  </span>
                </div>
              ) : (
                activeMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`ai-cli-message ai-cli-message--${message.role}`}
                  >
                    <div className="ai-cli-message-label">
                      {message.role === "user"
                        ? "You"
                        : message.role === "assistant"
                          ? activeItem.name
                          : "Hermes OS"}
                    </div>
                    <div className="ai-cli-message-body">{message.content}</div>
                  </div>
                ))
              )}
              {running[activeItem.id] && (
                <div className="ai-cli-message ai-cli-message--assistant">
                  <div className="ai-cli-message-label">{activeItem.name}</div>
                  <div className="ai-cli-message-body">Thinking...</div>
                </div>
              )}
            </div>

            {lastRuns[activeItem.id] && (
              <div
                className={`ai-cli-result ${
                  lastRuns[activeItem.id].success
                    ? "ai-cli-result--success"
                    : "ai-cli-result--error"
                }`}
              >
                <div className="ai-cli-result-meta">
                  <code>
                    {lastRuns[activeItem.id].command} conversation replay
                  </code>
                  {lastRuns[activeItem.id].exitCode !== null && (
                    <span>exit {lastRuns[activeItem.id].exitCode}</span>
                  )}
                </div>
              </div>
            )}

            <div className="ai-cli-composer">
              <textarea
                className="ai-cli-prompt"
                value={drafts[activeItem.id] || ""}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [activeItem.id]: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void sendMessage(activeItem);
                  }
                }}
                placeholder={
                  activeItem.promptMode
                    ? `Message ${activeItem.name}...`
                    : "Use Terminal for this CLI until a prompt mode is added."
                }
                disabled={!activeItem.installed || !activeItem.promptMode}
              />
              <button
                className="btn-primary ai-cli-run-btn"
                type="button"
                onClick={() => void sendMessage(activeItem)}
                disabled={
                  !activeItem.installed ||
                  !activeItem.promptMode ||
                  running[activeItem.id] ||
                  !(drafts[activeItem.id] || "").trim()
                }
              >
                <Send size={14} />
                {running[activeItem.id] ? "Sending..." : "Send"}
              </button>
            </div>
          </section>
        ) : (
          <div className="ai-clis-error">No AI CLI definitions were loaded.</div>
        )}
      </div>
    </div>
  );
}

export default AiClis;
