import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../../components/ThemeProvider";
import { useFont } from "../../components/FontProvider";
import { THEMES, FONT_OPTIONS } from "../../constants";
import { useI18n } from "../../components/useI18n";
import { APP_LOCALES, type AppLocale } from "../../../../shared/i18n";
import {
  Check,
  ChevronDown,
  Download,
  Upload,
  FileText,
  Send,
  Sliders,
  Cpu,
  MessageSquare,
  Shield,
  Database,
  Volume2,
  Wrench,
  FolderOpen,
  KeyRound,
  Puzzle,
  Activity,
} from "lucide-react";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
} from "../../utils/analytics";
import { ConfigHealth } from "./ConfigHealth";
import ModelsScreen from "../Models/Models";
import ProvidersScreen from "../Providers/Providers";
import ToolsScreen from "../Tools/Tools";
import GatewayScreen from "../Gateway/Gateway";

const DISCORD_COMMUNITY_URL = "https://discord.gg/vMwcnNPHc";

const LANGUAGE_NATIVE_NAMES: Record<AppLocale, string> = {
  en: "English",
  es: "Español",
  id: "Bahasa Indonesia",
  ja: "日本語",
  pl: "Polski",
  "pt-BR": "Português (BR)",
  "pt-PT": "Português (PT)",
  tr: "Türkçe",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文（台灣）",
};

function makeApiKeyMask(length: number): string {
  const n = Math.min(Math.max(length, 8), 128);
  return "*".repeat(n);
}

function getCachedVersion(): string | null {
  try {
    return localStorage.getItem("hermes-version-cache");
  } catch {
    return null;
  }
}

function getCachedOpenClaw(): { found: boolean; path: string | null } | null {
  try {
    const raw = localStorage.getItem("hermes-openclaw-cache");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function Settings({ profile }: { profile?: string }): React.JSX.Element {
  const { t, locale, setLocale } = useI18n();
  const [hermesHome, setHermesHome] = useState("");
  const { theme, setTheme, rounded, setRounded } = useTheme();
  const { font, setFont } = useFont();

  const [activeTab, setActiveTab] = useState<
    | "general"
    | "models"
    | "api-keys"
    | "capabilities"
    | "status"
    | "chat"
    | "safety"
    | "memory"
    | "voice"
    | "advanced"
  >("general");

  // Nous Research settings config keys
  const [config, setConfigState] = useState<Record<string, string>>({
    "agent.model": "",
    "agent.fallback_model": "",
    "agent.temperature": "0.7",
    "agent.max_tokens": "4096",
    "agent.system_prompt": "",
    "agent.reasoning_effort": "",
    "agent.service_tier": "fast",
    "chat.auto_save_sessions": "true",
    "chat.show_thoughts_default": "true",
    "safety.enabled": "false",
    "safety.profile": "llama-guard",
    "safety.block_trigger": "",
    "voice.stt_enabled": "false",
    "voice.tts_enabled": "false",
    "voice.tts_voice": "alloy",
    "memory.provider": "",
    "selfVaultRoot": "",
  });

  const [hermesVersion, setHermesVersion] = useState<string | null>(
    getCachedVersion,
  );
  const [appVersion, setAppVersion] = useState("");
  const [doctorOutput, setDoctorOutput] = useState<string | null>(null);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [updateResultType, setUpdateResultType] = useState<
    "success" | "error" | null
  >(null);

  const cachedClaw = getCachedOpenClaw();
  const [openclawFound, setOpenclawFound] = useState(
    cachedClaw?.found ?? false,
  );
  const [openclawPath, setOpenclawPath] = useState<string | null>(
    cachedClaw?.path ?? null,
  );
  const [migrationDismissed, setMigrationDismissed] = useState(
    () => localStorage.getItem("hermes-openclaw-dismissed") === "true",
  );
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState("");
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const [migrationResultType, setMigrationResultType] = useState<
    "success" | "error" | null
  >(null);
  const migrationLogRef = useRef<HTMLPreElement>(null);

  // Connection mode
  const [connMode, setConnMode] = useState<"local" | "remote" | "ssh">("local");
  const [connRemoteUrl, setConnRemoteUrl] = useState("");
  const [connApiKey, setConnApiKey] = useState("");
  const [connApiKeyMask, setConnApiKeyMask] = useState("");
  const [connHasApiKey, setConnHasApiKey] = useState(false);
  const [connTesting, setConnTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<string | null>(null);
  const connLoaded = useRef(false);
  const [apiServerKeyMissing, setApiServerKeyMissing] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);

  // SSH connection state
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("");
  const [sshUser, setSshUser] = useState("");
  const [sshKeyPath, setSshKeyPath] = useState("");
  const [sshRemotePort, setSshRemotePort] = useState("");

  // Backup / Import state
  const [backingUp, setBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Log viewer state
  const [logContent, setLogContent] = useState("");
  const [logFile, setLogFile] = useState("gateway.log");
  const [logPath, setLogPath] = useState("");
  const [logsExpanded, setLogsExpanded] = useState(false);

  // Network settings
  const [forceIpv4, setForceIpv4] = useState(false);
  const [httpProxy, setHttpProxy] = useState("");
  const httpProxyRef = useRef("");
  const savedHttpProxyRef = useRef("");
  const [networkSaved, setNetworkSaved] = useState(false);

  // Debug dump
  const [dumpOutput, setDumpOutput] = useState<string | null>(null);
  const [dumpRunning, setDumpRunning] = useState(false);

  // Analytics consent
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() =>
    getAnalyticsConsent(),
  );

  const loadConfig = useCallback(async (): Promise<void> => {
    const [home, aVersion, conn, keyStatus] = await Promise.all([
      window.hermesAPI.getHermesHome(profile),
      window.hermesAPI.getAppVersion(),
      window.hermesAPI.getConnectionConfig(),
      window.hermesAPI.getApiServerKeyStatus(profile),
    ]);
    setHermesHome(home);
    setAppVersion(aVersion);
    setConnMode(conn.mode);
    setConnRemoteUrl(conn.remoteUrl);
    setConnHasApiKey(conn.hasApiKey);
    const mask = conn.hasApiKey ? makeApiKeyMask(conn.apiKeyLength) : "";
    setConnApiKeyMask(mask);
    setConnApiKey(mask);
    setSshHost(conn.ssh?.host || "");
    setSshPort(conn.ssh?.port ? String(conn.ssh.port) : "");
    setSshUser(conn.ssh?.username || "");
    setSshKeyPath(conn.ssh?.keyPath || "");
    setSshRemotePort(conn.ssh?.remotePort ? String(conn.ssh.remotePort) : "");
    setApiServerKeyMissing(!keyStatus.hasKey);
    connLoaded.current = true;

    // Load network settings from config.yaml
    window.hermesAPI.getConfig("network.force_ipv4", profile).then((v) => {
      setForceIpv4(v === "true" || v === "True");
    });
    window.hermesAPI.getConfig("network.proxy", profile).then((v) => {
      const loadedProxy = v || "";
      setHttpProxy(loadedProxy);
      httpProxyRef.current = loadedProxy;
      savedHttpProxyRef.current = loadedProxy.trim();
    });

    // Load Nous config keys
    const keys = Object.keys(config);
    const loaded: Record<string, string> = {};
    await Promise.all(
      keys.map(async (k) => {
        let val = "";
        if (k === "selfVaultRoot") {
          const ws = await window.hermesAPI.selfGetWorkspace();
          val = ws.vaultRoot;
        } else {
          val = (await window.hermesAPI.getConfig(k, profile)) || "";
        }
        loaded[k] = val;
      }),
    );
    setConfigState((prev) => ({ ...prev, ...loaded }));

    // Defer slow calls
    window.hermesAPI.getHermesVersion().then((v) => {
      setHermesVersion(v);
      if (v) {
        try {
          localStorage.setItem("hermes-version-cache", v);
        } catch {
          /* ignore */
        }
      }
    });

    if (localStorage.getItem("hermes-openclaw-dismissed") !== "true") {
      window.hermesAPI.checkOpenClaw().then((claw) => {
        setOpenclawFound(claw.found);
        setOpenclawPath(claw.path);
        try {
          localStorage.setItem("hermes-openclaw-cache", JSON.stringify(claw));
        } catch {
          /* ignore */
        }
      });
    }
  }, [profile]);

  useEffect(() => {
    void Promise.resolve().then(loadConfig);
  }, [loadConfig]);

  const saveHttpProxy = useCallback(async (): Promise<void> => {
    const trimmed = httpProxyRef.current.trim();
    if (trimmed === savedHttpProxyRef.current) return;
    await window.hermesAPI.setConfig("network.proxy", trimmed, profile);
    savedHttpProxyRef.current = trimmed;
    setNetworkSaved(true);
    setTimeout(() => setNetworkSaved(false), 2000);
  }, [profile]);

  useEffect(() => {
    httpProxyRef.current = httpProxy;
  }, [httpProxy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void saveHttpProxy();
    }, 500);
    return () => clearTimeout(timer);
  }, [httpProxy, saveHttpProxy]);

  useEffect(() => {
    return () => {
      void saveHttpProxy();
    };
  }, [saveHttpProxy]);

  async function handleConfigChange(key: string, value: string) {
    setConfigState((prev) => ({ ...prev, [key]: value }));
    if (key === "selfVaultRoot") {
      await window.hermesAPI.selfSetVaultRoot(value);
    } else {
      await window.hermesAPI.setConfig(key, value, profile);
    }
  }

  async function handleBrowseVaultRoot() {
    const selected = await window.hermesAPI.selectFolder();
    if (selected) {
      void handleConfigChange("selfVaultRoot", selected);
    }
  }

  async function handleMigrate(): Promise<void> {
    setMigrating(true);
    setMigrationLog("");
    setMigrationResult(null);

    const cleanup = window.hermesAPI.onInstallProgress((p) => {
      setMigrationLog(p.log);
    });

    try {
      const result = await window.hermesAPI.runClawMigrate();
      cleanup();
      if (result.success) {
        setMigrationResult(t("settings.migrationComplete"));
        setMigrationResultType("success");
        setOpenclawFound(false);
      } else {
        setMigrationResult(result.error || t("settings.migrationFailed"));
        setMigrationResultType("error");
      }
    } catch (err) {
      cleanup();
      setMigrationResult(
        (err as Error).message || t("settings.migrationFailed"),
      );
      setMigrationResultType("error");
    }
    setMigrating(false);
  }

  function handleDismissMigration(): void {
    localStorage.setItem("hermes-openclaw-dismissed", "true");
    setMigrationDismissed(true);
  }

  function getConnectionApiKeyForSave(): string | undefined {
    if (connHasApiKey && connApiKey === connApiKeyMask) {
      return undefined;
    }
    return connApiKey.trim();
  }

  async function handleSaveConnection(): Promise<void> {
    if (connMode === "ssh") {
      await window.hermesAPI.setSshConfig(
        sshHost.trim(),
        parseInt(sshPort, 10) || 22,
        sshUser.trim(),
        sshKeyPath.trim(),
        parseInt(sshRemotePort, 10) || 8642,
        18642,
      );
    } else {
      const apiKey = getConnectionApiKeyForSave();
      await window.hermesAPI.setConnectionConfig(
        connMode,
        connRemoteUrl,
        apiKey,
      );
      if (apiKey !== undefined) {
        const hasApiKey = apiKey.length > 0;
        setConnHasApiKey(hasApiKey);
        if (hasApiKey) {
          const mask = makeApiKeyMask(apiKey.length);
          setConnApiKeyMask(mask);
          setConnApiKey(mask);
        } else {
          setConnApiKeyMask("");
        }
      }
    }
    setConnStatus("Saved");
    setTimeout(() => setConnStatus(null), 2000);
  }

  async function handleTestConnection(): Promise<void> {
    if (connMode === "ssh") {
      if (!sshHost.trim() || !sshUser.trim()) {
        setConnStatus(t("settings.sshErrorRequiredSimple"));
        return;
      }
      setConnTesting(true);
      setConnStatus(null);
      const ok = await window.hermesAPI.testSshConnection(
        sshHost.trim(),
        parseInt(sshPort, 10) || 22,
        sshUser.trim(),
        sshKeyPath.trim(),
        parseInt(sshRemotePort, 10) || 8642,
      );
      setConnTesting(false);
      setConnStatus(
        ok ? t("settings.sshSuccess") : t("settings.sshErrorFailedSimple"),
      );
    } else {
      const url = connRemoteUrl.trim();
      if (!url) {
        setConnStatus(t("settings.remoteErrorRequiredSimple"));
        return;
      }
      setConnTesting(true);
      setConnStatus(null);
      const ok = await window.hermesAPI.testRemoteConnection(
        url,
        getConnectionApiKeyForSave(),
      );
      setConnTesting(false);
      setConnStatus(
        ok
          ? t("settings.remoteSuccess")
          : t("settings.remoteErrorFailedSimple"),
      );
    }
  }

  async function handleSwitchToLocal(): Promise<void> {
    setConnMode("local");
    setConnRemoteUrl("");
    setConnApiKey("");
    setConnApiKeyMask("");
    setConnHasApiKey(false);
    await window.hermesAPI.setConnectionConfig("local", "", "");
    setConnStatus(t("settings.switchedToLocal"));
    setTimeout(() => setConnStatus(null), 2000);
  }

  async function handleBackup(): Promise<void> {
    setBackingUp(true);
    setBackupResult(null);
    const result = await window.hermesAPI.runHermesBackup(profile);
    setBackingUp(false);
    if (result.success) {
      setBackupResult(`Backup created: ${result.path || "success"}`);
    } else {
      setBackupResult(result.error || "Backup failed.");
    }
  }

  async function handleImport(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".tar.gz,.tgz,.zip";
    input.onchange = async (): Promise<void> => {
      const file = input.files?.[0];
      if (!file) return;
      setImporting(true);
      setImportResult(null);
      const filePath = (file as File & { path: string }).path;
      const result = await window.hermesAPI.runHermesImport(filePath, profile);
      setImporting(false);
      if (result.success) {
        setImportResult(t("settings.migrationComplete"));
      } else {
        setImportResult(result.error || t("settings.migrationFailed"));
      }
    };
    input.click();
  }

  async function loadLogs(): Promise<void> {
    const result = await window.hermesAPI.readLogs(logFile, 300);
    setLogContent(result.content);
    setLogPath(result.path);
  }

  async function handleDoctor(): Promise<void> {
    setDoctorRunning(true);
    setDoctorOutput(null);
    const output = await window.hermesAPI.runHermesDoctor();
    setDoctorOutput(output);
    setDoctorRunning(false);
  }

  function refreshVersion(): void {
    window.hermesAPI.refreshHermesVersion().then((v) => {
      setHermesVersion(v);
      if (v) {
        try {
          localStorage.setItem("hermes-version-cache", v);
        } catch {
          /* ignore */
        }
      }
    });
  }

  async function handleUpdateHermes(): Promise<void> {
    setUpdating(true);
    setUpdateResult(null);
    const result = await window.hermesAPI.runHermesUpdate();
    setUpdating(false);
    if (result.success) {
      setUpdateResult(t("settings.updateSuccess"));
      setUpdateResultType("success");
      refreshVersion();
    } else {
      setUpdateResult(result.error || t("settings.updateFailed"));
      setUpdateResultType("error");
    }
  }

  const parsedVersion = (() => {
    if (!hermesVersion) return null;
    const v = hermesVersion;
    const version = v.match(/v([\d.]+)/)?.[1] || "";
    const date = v.match(/\(([\d.]+)\)/)?.[1] || "";
    const python = v.match(/Python:\s*([\d.]+)/)?.[1] || "";
    const sdk = v.match(/OpenAI SDK:\s*([\d.]+)/)?.[1] || "";
    const updateMatch = v.match(/Update available:\s*(.+?)(?:\s*—|$)/);
    const updateInfo = updateMatch?.[1]?.trim() || null;
    return { version, date, python, sdk, updateInfo };
  })();

  return (
    <div className="settings-split-container">
      <div className="settings-sidebar">
        <button
          className={`settings-sidebar-item ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          <Sliders size={16} />
          <span>General / Connection</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "models" ? "active" : ""}`}
          onClick={() => setActiveTab("models")}
        >
          <Cpu size={16} />
          <span>Models</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "api-keys" ? "active" : ""}`}
          onClick={() => setActiveTab("api-keys")}
        >
          <KeyRound size={16} />
          <span>API Keys</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "capabilities" ? "active" : ""}`}
          onClick={() => setActiveTab("capabilities")}
        >
          <Puzzle size={16} />
          <span>Capabilities</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          <MessageSquare size={16} />
          <span>Chat Settings</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "safety" ? "active" : ""}`}
          onClick={() => setActiveTab("safety")}
        >
          <Shield size={16} />
          <span>Safety Thresholds</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "memory" ? "active" : ""}`}
          onClick={() => setActiveTab("memory")}
        >
          <Database size={16} />
          <span>Memory / Vault</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "voice" ? "active" : ""}`}
          onClick={() => setActiveTab("voice")}
        >
          <Volume2 size={16} />
          <span>Voice STT / TTS</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "advanced" ? "active" : ""}`}
          onClick={() => setActiveTab("advanced")}
        >
          <Wrench size={16} />
          <span>Workspace / Advanced</span>
        </button>
        <button
          className={`settings-sidebar-item ${activeTab === "status" ? "active" : ""}`}
          onClick={() => setActiveTab("status")}
        >
          <Activity size={16} />
          <span>System Status</span>
        </button>
      </div>

      <div className="settings-main-content">
        <h1 className="settings-header" style={{ marginBottom: 20 }}>
          {activeTab === "general" && "General & Connection"}
          {activeTab === "models" && "Model Configurations"}
          {activeTab === "api-keys" && "API Keys"}
          {activeTab === "capabilities" && "Capabilities"}
          {activeTab === "chat" && "Chat Behavior"}
          {activeTab === "safety" && "Safety Thresholds"}
          {activeTab === "memory" && "Memory / Context"}
          {activeTab === "voice" && "Voice STT / TTS"}
          {activeTab === "advanced" && "Workspace & Advanced"}
          {activeTab === "status" && "System Status"}
        </h1>

        {activeTab === "general" && (
          <div className="settings-tab-pane">
            <ConfigHealth />

            <div className="settings-section">
              <div className="settings-section-title">
                {t("settings.connectionSection")}
                {connStatus && (
                  <span className="settings-saved" style={{ marginLeft: 8 }}>
                    {connStatus}
                  </span>
                )}
              </div>

              <div className="settings-field">
                <label className="settings-field-label">
                  {t("settings.connectionMode")}
                </label>
                <div className="settings-theme-options">
                  <button
                    className={`settings-theme-option ${connMode === "local" ? "active" : ""}`}
                    onClick={() => {
                      setConnMode("local");
                      if (connLoaded.current) handleSwitchToLocal();
                    }}
                  >
                    {t("settings.modeLocal")}
                  </button>
                  <button
                    className={`settings-theme-option ${connMode === "remote" ? "active" : ""}`}
                    onClick={() => setConnMode("remote")}
                  >
                    {t("settings.modeRemote")}
                  </button>
                  <button
                    className={`settings-theme-option ${connMode === "ssh" ? "active" : ""}`}
                    onClick={() => setConnMode("ssh")}
                  >
                    {t("settings.modeSsh")}
                  </button>
                </div>
              </div>

              {!apiServerKeyMissing ? null : connMode === "local" ? (
                <div className="settings-api-key-banner">
                  <div className="settings-api-key-banner-title">
                    {t("settings.sessionDisabledTitle")}
                  </div>
                  <div className="settings-api-key-banner-desc">
                    {t("settings.sessionDisabledDesc")}
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={generatingKey}
                    onClick={async () => {
                      setGeneratingKey(true);
                      await window.hermesAPI.generateApiServerKey(profile);
                      setApiServerKeyMissing(false);
                      setGeneratingKey(false);
                      setConnStatus(t("settings.apiGenerated"));
                      setTimeout(() => setConnStatus(null), 4000);
                    }}
                  >
                    {generatingKey
                      ? t("settings.generating")
                      : t("settings.generateKey")}
                  </button>
                </div>
              ) : (
                <div className="settings-api-key-banner settings-api-key-banner--info">
                  <div className="settings-api-key-banner-title">
                    {t("settings.remoteEnvTitle")}
                  </div>
                  <div className="settings-api-key-banner-desc">
                    {connMode === "ssh"
                      ? t("settings.remoteEnvSshDesc")
                      : t("settings.remoteEnvDesc")}
                  </div>
                </div>
              )}

              {connMode === "remote" && (
                <>
                  <div className="settings-field">
                    <label className="settings-field-label">
                      {t("settings.remoteUrl")}
                    </label>
                    <input
                      className="input"
                      type="url"
                      value={connRemoteUrl}
                      onChange={(e) => setConnRemoteUrl(e.target.value)}
                      placeholder="http://192.168.1.100:8642"
                      onBlur={handleSaveConnection}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">
                      {t("settings.remoteApiKey")}
                    </label>
                    <input
                      className="input"
                      type="password"
                      value={connApiKey}
                      onChange={(e) => setConnApiKey(e.target.value)}
                      onFocus={(e) => {
                        if (connApiKey === connApiKeyMask) {
                          e.currentTarget.select();
                        }
                      }}
                      placeholder={t("settings.remoteApiKey")}
                      onBlur={handleSaveConnection}
                    />
                  </div>
                  <div className="settings-hermes-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={handleTestConnection}
                      disabled={connTesting}
                    >
                      {connTesting
                        ? t("settings.testingConnection")
                        : t("settings.testConnection")}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveConnection}
                    >
                      {t("settings.save")}
                    </button>
                  </div>
                </>
              )}

              {connMode === "ssh" && (
                <>
                  <div className="settings-field">
                    <label className="settings-field-label">
                      {t("settings.sshHost")}
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                      placeholder={t("settings.sshHostPlaceholder")}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">
                      {t("settings.sshPort")}
                    </label>
                    <input
                      className="input"
                      type="number"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      placeholder="22"
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">
                      {t("settings.sshUsername")}
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={sshUser}
                      onChange={(e) => setSshUser(e.target.value)}
                      placeholder={t("settings.sshUsernamePlaceholder")}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">
                      {t("settings.sshKeyPath")}{" "}
                      <span style={{ fontWeight: 400, opacity: 0.6 }}>
                        {t("settings.sshKeyPathOptional")}
                      </span>
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={sshKeyPath}
                      onChange={(e) => setSshKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_rsa"
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">
                      {t("settings.sshRemotePort")}{" "}
                      <span style={{ fontWeight: 400, opacity: 0.6 }}>
                        {t("settings.sshRemotePortDefault")}
                      </span>
                    </label>
                    <input
                      className="input"
                      type="number"
                      value={sshRemotePort}
                      onChange={(e) => setSshRemotePort(e.target.value)}
                      placeholder="8642"
                    />
                  </div>
                  <div className="settings-hermes-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={handleTestConnection}
                      disabled={connTesting}
                    >
                      {connTesting
                        ? t("settings.testingSsh")
                        : t("settings.testSsh")}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveConnection}
                    >
                      {t("settings.save")}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                {t("settings.sections.appearance")}
              </div>
              <div className="settings-field">
                <label className="settings-field-label">
                  {t("settings.theme.label")}
                </label>
                <div className="settings-theme-grid">
                  {THEMES.map((th) => {
                    const active = theme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        className={`settings-theme-card ${active ? "active" : ""}`}
                        onClick={() => setTheme(th.id)}
                      >
                        <div
                          className="settings-theme-preview"
                          data-theme={th.id}
                        >
                          <div className="settings-theme-preview-sidebar" />
                          <div className="settings-theme-preview-main">
                            <div className="settings-theme-preview-bar accent" />
                            <div className="settings-theme-preview-bar text" />
                            <div className="settings-theme-preview-bar" />
                          </div>
                        </div>
                        <div className="settings-theme-card-row">
                          <span className="settings-theme-card-name">
                            {th.name}
                          </span>
                          {active && (
                            <span className="settings-theme-card-check">
                              <Check size={14} />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-theme-system">
                  <div>
                    <div className="settings-theme-system-label">
                      {t("settings.roundedCorners.label")}
                    </div>
                    <div className="settings-theme-system-hint">
                      {t("settings.roundedCorners.hint")}
                    </div>
                  </div>
                  <label
                    className="tools-toggle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={rounded}
                      onChange={() => setRounded(!rounded)}
                    />
                    <span className="tools-toggle-track" />
                  </label>
                </div>
              </div>
              <div className="settings-field">
                <label className="settings-field-label">
                  {t("settings.font.label")}
                </label>
                <div className="settings-theme-options">
                  {FONT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`settings-theme-option ${font === opt.value ? "active" : ""}`}
                      style={{ fontFamily: opt.stack }}
                      onClick={() => setFont(opt.value)}
                    >
                      {t(opt.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-field">
                <label className="settings-field-label">
                  {t("settings.language.label")}
                </label>
                <LanguageSelect locale={locale} onSelect={setLocale} />
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                {t("settings.sections.privacy")}
              </div>
              <div className="settings-field">
                <label className="settings-field-label">
                  {t("settings.analytics.label")}
                  <label
                    className="tools-toggle"
                    style={{ marginLeft: 12, verticalAlign: "middle" }}
                  >
                    <input
                      type="checkbox"
                      checked={analyticsEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setAnalyticsEnabled(enabled);
                        setAnalyticsConsent(enabled);
                      }}
                    />
                    <span className="tools-toggle-track" />
                  </label>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === "models" && (
          <div className="settings-tab-pane">
            <div className="settings-section">
              <div className="settings-section-title">Model Configuration</div>

              <div className="settings-field">
                <label className="settings-field-label">Default Model</label>
                <input
                  className="input"
                  type="text"
                  value={config["agent.model"]}
                  onChange={(e) =>
                    handleConfigChange("agent.model", e.target.value)
                  }
                  placeholder="e.g. nousresearch/hermes-3-llama-3.1-405b:free"
                />
                <div className="settings-field-hint">
                  The primary model used for general tasks and chats.
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label">Fallback Model</label>
                <input
                  className="input"
                  type="text"
                  value={config["agent.fallback_model"]}
                  onChange={(e) =>
                    handleConfigChange("agent.fallback_model", e.target.value)
                  }
                  placeholder="e.g. gpt-4o-mini"
                />
                <div className="settings-field-hint">
                  The model to fall back to if the default model fails or is
                  busy.
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label">
                  Temperature: {config["agent.temperature"]}
                </label>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    style={{ flex: 1, accentColor: "#a855f7" }}
                    value={config["agent.temperature"]}
                    onChange={(e) =>
                      handleConfigChange("agent.temperature", e.target.value)
                    }
                  />
                  <input
                    type="number"
                    className="input"
                    style={{ width: 70 }}
                    min="0"
                    max="2"
                    step="0.1"
                    value={config["agent.temperature"]}
                    onChange={(e) =>
                      handleConfigChange("agent.temperature", e.target.value)
                    }
                  />
                </div>
                <div className="settings-field-hint">
                  Controls randomness: lower values are more deterministic,
                  higher values are more creative.
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label">Max Tokens</label>
                <input
                  className="input"
                  type="number"
                  value={config["agent.max_tokens"]}
                  onChange={(e) =>
                    handleConfigChange("agent.max_tokens", e.target.value)
                  }
                  placeholder="4096"
                />
                <div className="settings-field-hint">
                  Maximum response length per generation request.
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label">System Prompt</label>
                <textarea
                  className="input"
                  style={{ minHeight: 120, fontFamily: "monospace" }}
                  value={config["agent.system_prompt"]}
                  onChange={(e) =>
                    handleConfigChange("agent.system_prompt", e.target.value)
                  }
                  placeholder="Define the agent's core instructions and behavior..."
                />
                <div className="settings-field-hint">
                  Inject global instructions prepended to all agent threads.
                </div>
              </div>
            </div>

            <div className="settings-section" style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
              <ModelsScreen visible={activeTab === "models"} />
            </div>
          </div>
        )}

        {activeTab === "api-keys" && (
          <div className="settings-tab-pane">
            <ProvidersScreen profile={profile} visible={activeTab === "api-keys"} />
          </div>
        )}

        {activeTab === "capabilities" && (
          <div className="settings-tab-pane">
            <ToolsScreen profile={profile} visible={activeTab === "capabilities"} />
          </div>
        )}

        {activeTab === "status" && (
          <div className="settings-tab-pane">
            <GatewayScreen profile={profile} />
          </div>
        )}

        {activeTab === "chat" && (
          <div className="settings-tab-pane">
            <div className="settings-section">
              <div className="settings-section-title">Chat Settings</div>

              <div className="settings-field">
                <label className="settings-field-label">Service Tier</label>
                <select
                  className="input"
                  value={config["agent.service_tier"]}
                  onChange={(e) =>
                    handleConfigChange("agent.service_tier", e.target.value)
                  }
                >
                  <option value="fast">Fast</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
                <div className="settings-field-hint">
                  Priority level for routing inference requests.
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label">Reasoning Effort</label>
                <select
                  className="input"
                  value={config["agent.reasoning_effort"]}
                  onChange={(e) =>
                    handleConfigChange("agent.reasoning_effort", e.target.value)
                  }
                >
                  <option value="">Auto (Model Default)</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <div className="settings-field-hint">
                  Amount of reasoning effort allocated for models supporting it.
                </div>
              </div>

              <div className="settings-field">
                <div className="settings-theme-system">
                  <div>
                    <div className="settings-theme-system-label">
                      Auto-Save Chat Sessions
                    </div>
                    <div className="settings-theme-system-hint">
                      Automatically persist session history.
                    </div>
                  </div>
                  <label className="tools-toggle">
                    <input
                      type="checkbox"
                      checked={config["chat.auto_save_sessions"] === "true"}
                      onChange={(e) =>
                        handleConfigChange(
                          "chat.auto_save_sessions",
                          e.target.checked ? "true" : "false",
                        )
                      }
                    />
                    <span className="tools-toggle-track" />
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <div className="settings-theme-system">
                  <div>
                    <div className="settings-theme-system-label">
                      Show Thoughts by Default
                    </div>
                    <div className="settings-theme-system-hint">
                      Always expand thinking traces in chat responses.
                    </div>
                  </div>
                  <label className="tools-toggle">
                    <input
                      type="checkbox"
                      checked={config["chat.show_thoughts_default"] === "true"}
                      onChange={(e) =>
                        handleConfigChange(
                          "chat.show_thoughts_default",
                          e.target.checked ? "true" : "false",
                        )
                      }
                    />
                    <span className="tools-toggle-track" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "safety" && (
          <div className="settings-tab-pane">
            <div className="settings-section">
              <div className="settings-section-title">Safety Thresholds</div>

              <div className="settings-field">
                <div className="settings-theme-system">
                  <div>
                    <div className="settings-theme-system-label">
                      Enable Safety Filtering
                    </div>
                    <div className="settings-theme-system-hint">
                      Filter query and response payloads for harmful content.
                    </div>
                  </div>
                  <label className="tools-toggle">
                    <input
                      type="checkbox"
                      checked={config["safety.enabled"] === "true"}
                      onChange={(e) =>
                        handleConfigChange(
                          "safety.enabled",
                          e.target.checked ? "true" : "false",
                        )
                      }
                    />
                    <span className="tools-toggle-track" />
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label">Safety Profile</label>
                <select
                  className="input"
                  value={config["safety.profile"]}
                  onChange={(e) =>
                    handleConfigChange("safety.profile", e.target.value)
                  }
                >
                  <option value="llama-guard">Llama Guard (Default)</option>
                  <option value="custom">Custom Filter Pattern</option>
                </select>
                <div className="settings-field-hint">
                  The moderator engine to run audits against.
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label">
                  Block Trigger Phrase
                </label>
                <input
                  className="input"
                  type="text"
                  value={config["safety.block_trigger"]}
                  onChange={(e) =>
                    handleConfigChange("safety.block_trigger", e.target.value)
                  }
                  placeholder="e.g. system violation, bypass-attempt"
                />
                <div className="settings-field-hint">
                  Harmful phrases that will force immediate thread termination.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "memory" && (
          <div className="settings-tab-pane">
            <div className="settings-section">
              <div className="settings-section-title">Obsidian Vault path</div>
              <div className="settings-field">
                <label className="settings-field-label">Vault Root Path</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    type="text"
                    style={{ flex: 1 }}
                    value={config["selfVaultRoot"]}
                    onChange={(e) =>
                      handleConfigChange("selfVaultRoot", e.target.value)
                    }
                    placeholder="/Users/username/Documents/Obsidian Vault"
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={handleBrowseVaultRoot}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <FolderOpen size={14} />
                    Browse...
                  </button>
                </div>
                <div className="settings-field-hint">
                  Root directory of your Obsidian Vault where all journal notes,
                  reviews, and graph indices are built.
                </div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Memory Provider</div>
              <div className="settings-field">
                <label className="settings-field-label">Provider Name</label>
                <select
                  className="input"
                  value={config["memory.provider"]}
                  onChange={(e) =>
                    handleConfigChange("memory.provider", e.target.value)
                  }
                >
                  <option value="">None (Disabled)</option>
                  <option value="honcho">Honcho</option>
                  <option value="retaindb">RetainDB</option>
                  <option value="mem0">Mem0</option>
                  <option value="byterover">ByteRover</option>
                  <option value="hindsight">Hindsight</option>
                  <option value="supermemory">SuperMemory</option>
                </select>
                <div className="settings-field-hint">
                  Select the database or agent memory provider for long-term
                  context retention.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "voice" && (
          <div className="settings-tab-pane">
            <div className="settings-section">
              <div className="settings-section-title">Voice STT / TTS</div>

              <div className="settings-field">
                <div className="settings-theme-system">
                  <div>
                    <div className="settings-theme-system-label">
                      Enable Speech-to-Text (STT)
                    </div>
                    <div className="settings-theme-system-hint">
                      Allow speech input from microphone.
                    </div>
                  </div>
                  <label className="tools-toggle">
                    <input
                      type="checkbox"
                      checked={config["voice.stt_enabled"] === "true"}
                      onChange={(e) =>
                        handleConfigChange(
                          "voice.stt_enabled",
                          e.target.checked ? "true" : "false",
                        )
                      }
                    />
                    <span className="tools-toggle-track" />
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <div className="settings-theme-system">
                  <div>
                    <div className="settings-theme-system-label">
                      Enable Text-to-Speech (TTS)
                    </div>
                    <div className="settings-theme-system-hint">
                      Speak agent responses aloud.
                    </div>
                  </div>
                  <label className="tools-toggle">
                    <input
                      type="checkbox"
                      checked={config["voice.tts_enabled"] === "true"}
                      onChange={(e) =>
                        handleConfigChange(
                          "voice.tts_enabled",
                          e.target.checked ? "true" : "false",
                        )
                      }
                    />
                    <span className="tools-toggle-track" />
                  </label>
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-field-label">TTS Voice Model</label>
                <select
                  className="input"
                  value={config["voice.tts_voice"]}
                  onChange={(e) =>
                    handleConfigChange("voice.tts_voice", e.target.value)
                  }
                >
                  <option value="alloy">Alloy</option>
                  <option value="echo">Echo</option>
                  <option value="fable">Fable</option>
                  <option value="onyx">Onyx</option>
                  <option value="nova">Nova</option>
                  <option value="shimmer">Shimmer</option>
                </select>
                <div className="settings-field-hint">
                  The spoken vocal identity.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "advanced" && (
          <div className="settings-tab-pane">
            <div className="settings-section">
              <div className="settings-section-title">
                {t("settings.sections.hermesAgent")}
              </div>
              <div className="settings-hermes-info">
                <div className="settings-hermes-row">
                  <div className="settings-hermes-detail">
                    <span className="settings-hermes-label">
                      {t("common.engine")}
                    </span>
                    {hermesVersion === null ? (
                      <span className="skeleton skeleton-sm" />
                    ) : (
                      <span className="settings-hermes-value">
                        {parsedVersion
                          ? `v${parsedVersion.version}`
                          : t("settings.notDetected")}
                      </span>
                    )}
                  </div>
                  <div className="settings-hermes-detail">
                    <span className="settings-hermes-label">
                      {t("common.released")}
                    </span>
                    {hermesVersion === null ? (
                      <span className="skeleton skeleton-sm" />
                    ) : (
                      <span className="settings-hermes-value">
                        {parsedVersion?.date || "—"}
                      </span>
                    )}
                  </div>
                  <div className="settings-hermes-detail">
                    <span className="settings-hermes-label">
                      {t("common.desktop")}
                    </span>
                    {!appVersion ? (
                      <span className="skeleton skeleton-sm" />
                    ) : (
                      <span className="settings-hermes-value">
                        {t("settings.version", { version: appVersion })}
                      </span>
                    )}
                  </div>
                  <div className="settings-hermes-detail">
                    <span className="settings-hermes-label">Python</span>
                    {hermesVersion === null ? (
                      <span className="skeleton skeleton-sm" />
                    ) : (
                      <span className="settings-hermes-value">
                        {parsedVersion?.python || "—"}
                      </span>
                    )}
                  </div>
                  <div className="settings-hermes-detail">
                    <span className="settings-hermes-label">OpenAI SDK</span>
                    {hermesVersion === null ? (
                      <span className="skeleton skeleton-sm" />
                    ) : (
                      <span className="settings-hermes-value">
                        {parsedVersion?.sdk || "—"}
                      </span>
                    )}
                  </div>
                  <div className="settings-hermes-detail">
                    <span className="settings-hermes-label">
                      {t("common.home")}
                    </span>
                    {!hermesHome ? (
                      <span className="skeleton skeleton-md" />
                    ) : (
                      <span className="settings-hermes-value settings-hermes-path">
                        {hermesHome}
                      </span>
                    )}
                  </div>
                </div>
                {parsedVersion?.updateInfo && (
                  <div className="settings-hermes-update-badge">
                    {parsedVersion.updateInfo}
                  </div>
                )}
                <div className="settings-hermes-actions">
                  {parsedVersion?.updateInfo ? (
                    <button
                      className="btn btn-primary"
                      onClick={handleUpdateHermes}
                      disabled={updating}
                    >
                      {updating
                        ? t("settings.updating")
                        : t("settings.updateEngine")}
                    </button>
                  ) : (
                    <button className="btn btn-secondary" disabled>
                      {t("settings.latestVersion")}
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={handleDoctor}
                    disabled={doctorRunning}
                  >
                    {doctorRunning
                      ? t("settings.runningDiagnosis")
                      : t("settings.runDiagnosis")}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      setDumpRunning(true);
                      setDumpOutput(null);
                      const output = await window.hermesAPI.runHermesDump();
                      setDumpOutput(output);
                      setDumpRunning(false);
                    }}
                    disabled={dumpRunning}
                  >
                    {dumpRunning ? t("settings.running") : t("settings.debugDump")}
                  </button>
                </div>
                {updateResult && (
                  <div
                    className={`settings-hermes-result ${updateResultType || "error"}`}
                  >
                    {updateResult}
                  </div>
                )}
                {doctorOutput && (
                  <pre className="settings-hermes-doctor">{doctorOutput}</pre>
                )}
                {dumpOutput && (
                  <pre className="settings-hermes-doctor">{dumpOutput}</pre>
                )}
              </div>
            </div>

            {openclawFound && !migrationDismissed && (
              <div className="settings-migration-banner">
                <div className="settings-migration-header">
                  <div>
                    <div className="settings-migration-title">
                      {t("settings.migrationDetected")}
                    </div>
                    <div
                      className="settings-migration-desc"
                      dangerouslySetInnerHTML={{
                        __html: t("settings.migrationDesc", {
                          path: openclawPath || "",
                        }),
                      }}
                    />
                  </div>
                  <button
                    className="btn-ghost settings-migration-dismiss"
                    onClick={handleDismissMigration}
                    title={t("settings.migrationDismiss")}
                  >
                    &times;
                  </button>
                </div>
                {migrationLog && (
                  <pre className="settings-hermes-doctor" ref={migrationLogRef}>
                    {migrationLog}
                  </pre>
                )}
                {migrationResult && (
                  <div
                    className={`settings-hermes-result ${migrationResultType || "error"}`}
                  >
                    {migrationResult}
                  </div>
                )}
                <div className="settings-migration-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleMigrate}
                    disabled={migrating}
                  >
                    {migrating
                      ? t("settings.migrating")
                      : t("settings.migrateToHermes")}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleDismissMigration}
                  >
                    {t("settings.skip")}
                  </button>
                </div>
              </div>
            )}

            <div className="settings-section">
              <div className="settings-section-title">
                {t("settings.networkSection")}
                {networkSaved && (
                  <span className="settings-saved" style={{ marginLeft: 8 }}>
                    {t("settings.saved")}
                  </span>
                )}
              </div>
              <div className="settings-field">
                <label className="settings-field-label">
                  {t("settings.forceIpv4")}
                  <label
                    className="tools-toggle"
                    style={{ marginLeft: 12, verticalAlign: "middle" }}
                  >
                    <input
                      type="checkbox"
                      checked={forceIpv4}
                      onChange={async (e) => {
                        const val = e.target.checked;
                        setForceIpv4(val);
                        await window.hermesAPI.setConfig(
                          "network.force_ipv4",
                          val ? "true" : "false",
                          profile,
                        );
                        setNetworkSaved(true);
                        setTimeout(() => setNetworkSaved(false), 2000);
                      }}
                    />
                    <span className="tools-toggle-track" />
                  </label>
                </label>
                <div className="settings-field-hint">
                  {t("settings.forceIpv4Hint")}
                </div>
              </div>
              <div className="settings-field">
                <label className="settings-field-label">
                  {t("settings.httpProxy")}
                </label>
                <input
                  className="input"
                  type="text"
                  value={httpProxy}
                  onChange={(e) => {
                    httpProxyRef.current = e.target.value;
                    setHttpProxy(e.target.value);
                  }}
                  onBlur={() => {
                    void saveHttpProxy();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void saveHttpProxy();
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder={t("settings.proxyPlaceholder")}
                />
                <div className="settings-field-hint">
                  {t("settings.httpProxyHint")}
                </div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                {t("settings.dataSection")}
              </div>
              <div className="settings-field">
                <div
                  className="settings-field-hint"
                  style={{ marginBottom: 10 }}
                >
                  {t("settings.dataHint")}
                </div>
                <div className="settings-hermes-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={handleBackup}
                    disabled={backingUp}
                  >
                    <Download size={14} style={{ marginRight: 6 }} />
                    {backingUp
                      ? t("settings.backingUp")
                      : t("settings.exportBackup")}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    <Upload size={14} style={{ marginRight: 6 }} />
                    {importing
                      ? t("settings.importing")
                      : t("settings.importBackup")}
                  </button>
                </div>
                {backupResult && (
                  <div
                    className={`settings-hermes-result ${backupResult.includes("created") || backupResult.includes("success") ? "success" : "error"}`}
                    style={{ marginTop: 8 }}
                  >
                    {backupResult}
                  </div>
                )}
                {importResult && (
                  <div
                    className={`settings-hermes-result ${importResult.includes("complete") ? "success" : "error"}`}
                    style={{ marginTop: 8 }}
                  >
                    {importResult}
                  </div>
                )}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <span
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    const next = !logsExpanded;
                    setLogsExpanded(next);
                    if (next) loadLogs();
                  }}
                >
                  <FileText
                    size={14}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
                  {t("settings.logsSection")} {logsExpanded ? "▾" : "▸"}
                </span>
              </div>
              {logsExpanded && (
                <div className="settings-field">
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    {["gateway.log", "agent.log", "errors.log"].map((f) => (
                      <button
                        key={f}
                        className={`btn btn-sm ${logFile === f ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => {
                          setLogFile(f);
                          window.hermesAPI.readLogs(f, 300).then((r) => {
                            setLogContent(r.content);
                            setLogPath(r.path);
                          });
                        }}
                      >
                        {f.replace(".log", "")}
                      </button>
                    ))}
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={loadLogs}
                    >
                      {t("settings.refresh")}
                    </button>
                  </div>
                  {logPath && (
                    <div
                      className="settings-field-hint"
                      style={{ marginBottom: 4 }}
                    >
                      {logPath}
                    </div>
                  )}
                  <pre
                    className="settings-hermes-doctor"
                    style={{
                      maxHeight: 300,
                      overflow: "auto",
                      fontSize: 11,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {logContent || t("settings.emptyLog")}
                  </pre>
                </div>
              )}
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                {t("settings.communityTitle")}
              </div>
              <div className="settings-field">
                <div
                  className="settings-field-hint"
                  style={{ marginBottom: 10 }}
                >
                  {t("settings.communityHint")}
                </div>
                <div className="settings-hermes-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      window.hermesAPI.openExternal(DISCORD_COMMUNITY_URL)
                    }
                    title={DISCORD_COMMUNITY_URL}
                  >
                    <Send size={14} style={{ marginRight: 6 }} />
                    {t("settings.joinDiscord")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface LanguageSelectProps {
  locale: AppLocale;
  onSelect: (l: AppLocale) => void;
}

function LanguageSelect({
  locale,
  onSelect,
}: LanguageSelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  return (
    <div className="settings-language-select" ref={ref}>
      <button
        type="button"
        className="settings-language-trigger"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{LANGUAGE_NATIVE_NAMES[locale]}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="settings-language-dropdown" role="listbox">
          {APP_LOCALES.map((l) => {
            const active = l === locale;
            return (
              <button
                key={l}
                type="button"
                role="option"
                aria-selected={active}
                className={`settings-language-option ${active ? "active" : ""}`}
                onClick={() => {
                  onSelect(l);
                  setIsOpen(false);
                }}
              >
                <span>{LANGUAGE_NATIVE_NAMES[l]}</span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Settings;
