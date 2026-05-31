import { useCallback, useEffect, useState } from "react";
import { Refresh, Bot, Check, Alert, Ban } from "../../assets/icons";

interface AiCliInfo {
  id: string;
  name: string;
  command: string;
  installed: boolean;
  path: string | null;
  version: string | null;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  description: string;
  error?: string;
}

function statusIcon(status: AiCliInfo["status"]): React.JSX.Element {
  if (status === "ONLINE") return <Check size={14} />;
  if (status === "DEGRADED") return <Alert size={14} />;
  return <Ban size={14} />;
}

function AiClis(): React.JSX.Element {
  const [items, setItems] = useState<AiCliInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await window.hermesAPI.listAiClis());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const online = items.filter((item) => item.status === "ONLINE").length;

  return (
    <div className="ai-clis-container">
      <div className="ai-clis-header">
        <div>
          <div className="ai-clis-kicker">Local wrappers</div>
          <h1 className="ai-clis-title">AI CLIs</h1>
          <p className="ai-clis-subtitle">
            One place to see the command-line agents Hermes OS can find on this
            machine.
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

      <div className="ai-clis-grid">
        {items.map((item) => (
          <section
            key={item.id}
            className={`ai-cli-card ai-cli-card--${item.status.toLowerCase()}`}
          >
            <div className="ai-cli-card-header">
              <div className="ai-cli-avatar">
                <Bot size={18} />
              </div>
              <div>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
              </div>
              <span className="ai-cli-status">
                {statusIcon(item.status)}
                {item.status}
              </span>
            </div>

            <dl className="ai-cli-details">
              <div>
                <dt>Command</dt>
                <dd>
                  <code>{item.command}</code>
                </dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{item.version || "Not available"}</dd>
              </div>
              <div>
                <dt>Path</dt>
                <dd>{item.path || "Not found on PATH"}</dd>
              </div>
            </dl>

            {item.error && <pre className="ai-cli-error">{item.error}</pre>}
          </section>
        ))}
      </div>
    </div>
  );
}

export default AiClis;
