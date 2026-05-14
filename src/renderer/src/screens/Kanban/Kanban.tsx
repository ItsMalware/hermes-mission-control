import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Refresh } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";

type KanbanState = "checking" | "ready" | "error";
type SessionTodo = { id: string; content: string; status: string };
type SessionTodoState = {
  sessionId: string;
  updatedAt: number;
  todos: SessionTodo[];
  summary: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
};

function Kanban({
  visible,
  profile,
}: {
  visible?: boolean;
  profile?: string;
}): React.JSX.Element {
  const { t } = useI18n();
  const [state, setState] = useState<KanbanState>("checking");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [dashboardUrl, setDashboardUrl] = useState(
    "http://127.0.0.1:9119/kanban",
  );
  const [error, setError] = useState("");
  const [webviewReady, setWebviewReady] = useState(false);
  const [webviewError, setWebviewError] = useState("");
  const [sessionTodoState, setSessionTodoState] =
    useState<SessionTodoState | null>(null);
  const webviewRef = useRef<HTMLWebViewElement>(null);

  const checkStatus = useCallback(async (): Promise<void> => {
    setState("checking");
    setError("");
    const [url, isRunning] = await Promise.all([
      window.hermesAPI.getDashboardUrl("/kanban"),
      window.hermesAPI.dashboardStatus(),
    ]);
    setDashboardUrl(url);
    setRunning(isRunning);
    setState("ready");
    setSessionTodoState(await window.hermesAPI.getSessionTodoState(profile));
  }, [profile]);

  useEffect(() => {
    queueMicrotask(() => {
      checkStatus().catch((err) => {
        setError((err as Error).message || t("kanban.statusFailed"));
        setState("error");
      });
    });
  }, [checkStatus, t]);

  useEffect(() => {
    if (state !== "ready" || !visible) return;
    const interval = setInterval(async () => {
      const isRunning = await window.hermesAPI.dashboardStatus();
      setRunning(isRunning);
      if (!isRunning) setWebviewReady(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [state, visible]);

  useEffect(() => {
    const wv = webviewRef.current as unknown as {
      addEventListener: (e: string, fn: (evt?: unknown) => void) => void;
      removeEventListener: (e: string, fn: (evt?: unknown) => void) => void;
    };
    if (!wv) return;
    const onLoad = (): void => {
      setWebviewReady(true);
      setWebviewError("");
    };
    const onFail = (evt: unknown): void => {
      setWebviewReady(false);
      const e = evt as { errorDescription?: string; errorCode?: number };
      if (e?.errorCode === -3) return;
      setWebviewError(e?.errorDescription || t("kanban.webviewLoadFailed"));
    };
    wv.addEventListener("did-finish-load", onLoad);
    wv.addEventListener("did-fail-load", onFail);
    return () => {
      wv.removeEventListener("did-finish-load", onLoad);
      wv.removeEventListener("did-fail-load", onFail);
    };
  }, [running, dashboardUrl, t]);

  async function handleStartStop(): Promise<void> {
    if (running) {
      await window.hermesAPI.stopDashboard();
      setRunning(false);
      setWebviewReady(false);
      setWebviewError("");
      return;
    }

    setStarting(true);
    setError("");
    setWebviewError("");
    const ok = await window.hermesAPI.startDashboard();
    setStarting(false);
    setRunning(ok);
    if (!ok) {
      setError(t("kanban.startFailed"));
      setState("error");
    } else {
      setState("ready");
    }
  }

  function refreshWebview(): void {
    setWebviewError("");
    window.hermesAPI.getSessionTodoState(profile).then(setSessionTodoState);
    const wv = webviewRef.current as unknown as { reload?: () => void };
    if (wv?.reload) wv.reload();
  }

  function renderTodoGroup(status: string, title: string): React.JSX.Element | null {
    const todos = sessionTodoState?.todos.filter((todo) => todo.status === status) || [];
    if (todos.length === 0) return null;
    return (
      <div className="kanban-session-group">
        <div className="kanban-session-group-title">{title}</div>
        <ul className="kanban-session-list">
          {todos.map((todo) => (
            <li key={todo.id} className="kanban-session-item">
              {status === "completed" ? "✓" : "•"} {todo.content.replace(/Notion: /g, "")}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (state === "checking") {
    return (
      <div className="settings-container">
        <h1 className="settings-header">{t("kanban.title")}</h1>
        <div className="office-center">
          <div className="office-spinner" />
          <p className="office-muted">{t("kanban.checkingStatus")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="office-ready">
      <div className="office-toolbar">
        <div className="office-toolbar-left">
          <h1 className="office-toolbar-title">{t("kanban.title")}</h1>
          <span
            className={`office-status-dot ${running ? "running" : "stopped"}`}
          />
          <span className="office-status-label">
            {starting
              ? t("kanban.starting")
              : running
                ? t("gateway.running")
                : t("gateway.stopped")}
          </span>
        </div>
        <div className="office-toolbar-right">
          <button
            className={`btn btn-sm ${running ? "btn-secondary" : "btn-primary"}`}
            onClick={handleStartStop}
            disabled={starting}
          >
            {starting
              ? t("kanban.starting")
              : running
                ? t("common.stop")
                : t("common.start")}
          </button>
          {running && (
            <>
              <button
                className="btn-ghost office-toolbar-btn"
                onClick={refreshWebview}
                title={t("common.refresh")}
              >
                <Refresh size={16} />
              </button>
              <button
                className="btn-ghost office-toolbar-btn"
                onClick={() => window.hermesAPI.openExternal(dashboardUrl)}
                title={t("kanban.openInBrowser")}
              >
                <ExternalLink size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="office-error-bar">
          <div className="office-error-text">{error}</div>
          <div className="office-error-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setError("");
                setState("ready");
              }}
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}

      {sessionTodoState && (
        <section className="kanban-session-panel">
          <div className="kanban-session-header">
            <div>
              <h2>HERMES KANBAN (Session State)</h2>
              <p>
                {sessionTodoState.summary.pending} pending ·{" "}
                {sessionTodoState.summary.completed} completed · session{" "}
                {sessionTodoState.sessionId}
              </p>
            </div>
            <button
              className="btn-ghost office-toolbar-btn"
              onClick={() =>
                window.hermesAPI
                  .getSessionTodoState(profile)
                  .then(setSessionTodoState)
              }
              title={t("common.refresh")}
            >
              <Refresh size={16} />
            </button>
          </div>
          <div className="kanban-session-columns">
            {renderTodoGroup("pending", "[PENDING]")}
            {renderTodoGroup("in_progress", "[IN PROGRESS]")}
            {renderTodoGroup("completed", "[COMPLETED]")}
          </div>
        </section>
      )}

      <div className="office-content">
        {running ? (
          <>
            {(!webviewReady || webviewError) && (
              <div className="office-loading-overlay">
                {webviewError ? (
                  <div className="office-webview-error">
                    <p className="office-webview-error-title">
                      {t("kanban.cannotLoad")}
                    </p>
                    <p className="office-muted">{webviewError}</p>
                    <div className="office-webview-error-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={refreshWebview}
                      >
                        {t("common.retry")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="office-spinner" />
                    <p className="office-muted">
                      {starting
                        ? t("kanban.startingService")
                        : t("kanban.loading")}
                    </p>
                  </>
                )}
              </div>
            )}
            <webview
              ref={webviewRef as React.RefObject<HTMLWebViewElement>}
              src={dashboardUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          </>
        ) : (
          <div className="office-center">
            <p className="office-muted">{t("kanban.clickToStart")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Kanban;
