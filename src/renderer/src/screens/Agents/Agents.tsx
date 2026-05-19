import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash,
  ChatBubble,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Users,
} from "../../assets/icons";
import HermesLogo from "../../components/common/HermesLogo";
import { useI18n } from "../../components/useI18n";

interface ProfileInfo {
  name: string;
  path: string;
  isDefault: boolean;
  isActive: boolean;
  model: string;
  provider: string;
  hasEnv: boolean;
  hasSoul: boolean;
  skillCount: number;
  gatewayRunning: boolean;
}

interface AgentsProps {
  activeProfile: string;
  onSelectProfile: (name: string) => void;
  onChatWith: (name: string) => void;
}

interface SecretSummary {
  key: string;
  profile: string;
  source: string;
  category: string;
  maskedValue: string;
  length: number;
}

function AgentAvatar({ name }: { name: string }): React.JSX.Element {
  if (name === "default") {
    return (
      <div className="agents-card-avatar agents-card-avatar-icon">
        <HermesLogo size={22} />
      </div>
    );
  }
  return (
    <div className="agents-card-avatar">{name.charAt(0).toUpperCase()}</div>
  );
}

function inferTeamName(profile: ProfileInfo): string {
  const name = profile.name.toLowerCase();
  if (profile.isDefault || name === "default") return "General";
  if (name.includes("director")) return "Directors";
  if (name.includes("dev") || name.includes("worker")) return "Development";
  if (name.includes("risk")) return "Risk";
  if (name.includes("intel")) return "Intel";
  if (name.includes("cozy")) return "CozyHub";
  if (name.includes("assistant")) return "Assistants";
  return "Specialists";
}

function secretId(secret: SecretSummary): string {
  return `${secret.profile}:${secret.key}`;
}

function Agents({
  activeProfile,
  onSelectProfile,
  onChatWith,
}: AgentsProps): React.JSX.Element {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [cloneConfig, setCloneConfig] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<SecretSummary[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(true);
  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<string, string>
  >({});
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [secretScanError, setSecretScanError] = useState("");

  const loadProfiles = useCallback(async (): Promise<void> => {
    try {
      const list = await window.hermesAPI.listProfiles();
      setProfiles(list);
      setLoading(false);
      setSecretsLoading(true);
      setSecretScanError("");
      const secretLists = await Promise.allSettled(
        list.map((profile) =>
          window.hermesAPI.listProfileSecrets(profile.name),
        ),
      );
      setSecrets(
        secretLists.flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        ),
      );
      if (secretLists.some((result) => result.status === "rejected")) {
        setSecretScanError("Some profile env files could not be scanned.");
      }
    } catch (err) {
      setError((err as Error).message || t("agents.createFailed"));
      setLoading(false);
      setSecrets([]);
    } finally {
      setSecretsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfiles();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfiles]);

  async function handleCreate(): Promise<void> {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    setCreating(true);
    setError("");
    const result = await window.hermesAPI.createProfile(name, cloneConfig);
    setCreating(false);
    if (result.success) {
      setShowCreate(false);
      setNewName("");
      loadProfiles();
    } else {
      setError(result.error || t("agents.createFailed"));
    }
  }

  async function handleDelete(name: string): Promise<void> {
    const result = await window.hermesAPI.deleteProfile(name);
    if (result.success) {
      if (activeProfile === name) onSelectProfile("default");
      loadProfiles();
    }
    setConfirmDelete(null);
  }

  async function handleSelect(name: string): Promise<void> {
    await window.hermesAPI.setActiveProfile(name);
    onSelectProfile(name);
    loadProfiles();
  }

  function providerLabel(provider: string): string {
    if (!provider || provider === "auto") return t("agents.auto");
    if (provider === "custom") return t("agents.local");
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  async function handleRevealSecret(secret: SecretSummary): Promise<void> {
    const id = secretId(secret);
    if (revealedSecrets[id]) {
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    const value = await window.hermesAPI.getEnvValue(
      secret.key,
      secret.profile,
    );
    setRevealedSecrets((prev) => ({ ...prev, [id]: value }));
  }

  async function handleCopySecret(secret: SecretSummary): Promise<void> {
    const value =
      revealedSecrets[secretId(secret)] ||
      (await window.hermesAPI.getEnvValue(secret.key, secret.profile));
    await navigator.clipboard.writeText(value);
    setCopiedSecret(secretId(secret));
    setTimeout(() => setCopiedSecret(null), 1600);
  }

  const teams = profiles.reduce<Record<string, ProfileInfo[]>>(
    (acc, profile) => {
      const team = inferTeamName(profile);
      acc[team] = acc[team] || [];
      acc[team].push(profile);
      return acc;
    },
    {},
  );

  if (loading) {
    return (
      <div className="agents-container">
        <div className="agents-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="agents-container">
      <div className="agents-header">
        <div>
          <h2 className="agents-title">{t("agents.title")}</h2>
          <p className="agents-subtitle">{t("agents.subtitle")}</p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} />
          {t("agents.newAgent")}
        </button>
      </div>

      {showCreate && (
        <div className="agents-create">
          <input
            className="input"
            placeholder={t("agents.namePlaceholder")}
            value={newName}
            onChange={(e) => {
              const v = e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "");
              setNewName(v);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <label className="agents-create-clone">
            <input
              type="checkbox"
              checked={cloneConfig}
              onChange={(e) => setCloneConfig(e.target.checked)}
            />
            <span>{t("agents.cloneConfig")}</span>
          </label>
          {error && <div className="agents-create-error">{error}</div>}
          <div className="agents-create-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? t("agents.creating") : t("agents.create")}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowCreate(false);
                setError("");
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="agents-grid">
        {profiles.map((p) => (
          <div
            key={p.name}
            className={`agents-card ${activeProfile === p.name ? "active" : ""}`}
            onClick={() => handleSelect(p.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSelect(p.name);
            }}
          >
            <div className="agents-card-header">
              <AgentAvatar name={p.name} />
              <div className="agents-card-info">
                <div className="agents-card-name">{p.name}</div>
                <div className="agents-card-provider">
                  {providerLabel(p.provider)}
                </div>
              </div>
              {activeProfile === p.name && (
                <span className="agents-card-active-badge">
                  {t("agents.active")}
                </span>
              )}
            </div>
            <div className="agents-card-model">
              {p.model ? p.model.split("/").pop() : t("agents.noModel")}
            </div>
            <div className="agents-card-stats">
              <span>{t("agents.skillsCount", { count: p.skillCount })}</span>
              <span className="agents-card-dot" />
              {p.gatewayRunning ? (
                <span className="agents-card-gateway-on">
                  {t("agents.gatewayRunning")}
                </span>
              ) : (
                <span>{t("agents.gatewayOff")}</span>
              )}
            </div>
            <div className="agents-card-footer">
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onChatWith(p.name);
                }}
              >
                <ChatBubble size={13} />
                {t("agents.chat")}
              </button>
              {!p.isDefault &&
                (confirmDelete === p.name ? (
                  <div
                    className="agents-card-confirm-delete"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{t("agents.deleteConfirm")}</span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.name);
                      }}
                    >
                      {t("agents.yes")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(null);
                      }}
                    >
                      {t("agents.no")}
                    </button>
                  </div>
                ) : (
                  <button
                    className="agents-card-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(p.name);
                    }}
                    title={t("agents.deleteTitle")}
                  >
                    <Trash size={14} />
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="agents-insights">
        <section className="agents-panel">
          <div className="agents-panel-header">
            <div className="agents-panel-title">
              <Users size={16} />
              Agent teams
            </div>
            <span className="agents-panel-count">
              {Object.keys(teams).length} teams
            </span>
          </div>
          <div className="agents-team-grid">
            {Object.entries(teams).map(([team, members]) => (
              <div key={team} className="agents-team-card">
                <div className="agents-team-card-header">
                  <span>{team}</span>
                  <span>{members.length}</span>
                </div>
                <div className="agents-team-members">
                  {members.map((member) => (
                    <button
                      key={member.name}
                      className={`agents-team-member ${
                        activeProfile === member.name ? "active" : ""
                      }`}
                      onClick={() => handleSelect(member.name)}
                    >
                      <span>{member.name}</span>
                      <span>{providerLabel(member.provider)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="agents-panel">
          <div className="agents-panel-header">
            <div className="agents-panel-title">
              <KeyRound size={16} />
              Secrets
            </div>
            <span className="agents-panel-count">
              {secretsLoading ? "Scanning" : `${secrets.length} found`}
            </span>
          </div>
          <div className="agents-secrets-table">
            {secretsLoading && (
              <div className="agents-empty-row">
                Scanning profile env files...
              </div>
            )}
            {!secretsLoading && secrets.length === 0 && (
              <div className="agents-empty-row">
                No API keys, tokens, or secrets found in Hermes profile env
                files.
              </div>
            )}
            {secretScanError && (
              <div className="agents-warning-row">{secretScanError}</div>
            )}
            {secrets.map((secret) => {
              const id = secretId(secret);
              const revealedValue = revealedSecrets[id];
              return (
                <div key={id} className="agents-secret-row">
                  <div className="agents-secret-main">
                    <span className="agents-secret-key">{secret.key}</span>
                    <span className="agents-secret-meta">
                      {secret.category} · {secret.profile}
                    </span>
                  </div>
                  <div className="agents-secret-value" title={secret.source}>
                    {revealedValue || secret.maskedValue}
                  </div>
                  <div className="agents-secret-actions">
                    <button
                      className="agents-icon-btn"
                      onClick={() => handleRevealSecret(secret)}
                      title={revealedValue ? "Hide secret" : "Reveal secret"}
                    >
                      {revealedValue ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      className={`agents-icon-btn ${
                        copiedSecret === id ? "copied" : ""
                      }`}
                      onClick={() => handleCopySecret(secret)}
                      title="Copy secret"
                    >
                      {copiedSecret === id ? "Copied" : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Agents;
