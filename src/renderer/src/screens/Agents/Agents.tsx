import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  ChevronDown,
} from "../../assets/icons";
import { useI18n } from "../../components/useI18n";
import {
  buildDirectorTeamGroups,
  inferProfileRole,
  roleLabel,
  type ProfileRole,
  type TeamMemberInfo,
} from "./team-groups";

interface ProfileInfo {
  name: string;
  path: string;
  isDefault: boolean;
  isActive: boolean;
  description: string;
  model: string;
  provider: string;
  role: ProfileRole;
  team: string;
  workerPoolPath: string;
  teamMembers: TeamMemberInfo[];
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

  // Persona (SOUL) editor state
  const [soulContent, setSoulContent] = useState("");
  const [soulExpanded, setSoulExpanded] = useState(false);
  const [soulSaved, setSoulSaved] = useState(false);
  const soulLoaded = useRef(false);
  const soulTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfiles = useCallback(async (): Promise<void> => {
    try {
      const list = await window.hermesAPI.listProfiles();
      setProfiles(list);
    } catch (err) {
      setError((err as Error).message || t("agents.createFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load the default persona
  useEffect(() => {
    soulLoaded.current = false;
    window.hermesAPI.readSoul(undefined).then((text) => {
      setSoulContent(text);
      setTimeout(() => { soulLoaded.current = true; }, 300);
    });
  }, []);

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

  async function handleSelect(name: string): Promise<void> {
    await window.hermesAPI.setActiveProfile(name);
    onSelectProfile(name);
    loadProfiles();
  }

  function handleSoulChange(text: string): void {
    setSoulContent(text);
    if (!soulLoaded.current) return;
    if (soulTimer.current) clearTimeout(soulTimer.current);
    soulTimer.current = setTimeout(async () => {
      await window.hermesAPI.writeSoul(text, undefined);
      setSoulSaved(true);
      setTimeout(() => setSoulSaved(false), 2000);
    }, 500);
  }

  const directorTeams = buildDirectorTeamGroups(profiles);

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
          <h2 className="agents-title">Teams</h2>
          <p className="agents-subtitle">
            {directorTeams.teams.length} teams · {profiles.length} agents
          </p>
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

      <section className="agents-panel agents-persona-section">
        <button
          className="agents-persona-toggle"
          onClick={() => setSoulExpanded(!soulExpanded)}
        >
          <div className="agents-panel-title">
            Hermes OS Persona
            {soulSaved && <span className="agents-persona-saved">Saved</span>}
          </div>
          <ChevronDown
            size={14}
            className={`agents-persona-chevron ${soulExpanded ? "expanded" : ""}`}
          />
        </button>
        {soulExpanded && (
          <textarea
            className="agents-persona-editor"
            value={soulContent}
            onChange={(e) => handleSoulChange(e.target.value)}
            placeholder="Define the default Hermes OS persona..."
            spellCheck={false}
          />
        )}
      </section>

      {directorTeams.teams.length === 0 ? (
        <div className="agents-empty-row">
          No director profiles found yet. Create a director profile to own a
          team.
        </div>
      ) : (
        <div className="agents-team-grid">
          {directorTeams.teams.map((team) => (
            <div key={team.id} className="agents-team-card">
              <div className="agents-team-card-header">
                <div>
                  <span>{team.label}</span>
                  <small>{team.owner.name}</small>
                </div>
                <span className="agents-team-member-count">
                  {team.profileMembers.length +
                    team.workerPoolMembers.length}{" "}
                  members
                </span>
              </div>
              {team.owner.description && (
                <div className="agents-team-goal">{team.owner.description}</div>
              )}
              <div className="agents-team-members">
                <button
                  className={`agents-team-member agents-team-owner ${
                    activeProfile === team.owner.name ? "active" : ""
                  }`}
                  onClick={() => handleSelect(team.owner.name)}
                >
                  <span>{team.owner.name}</span>
                  <span>{roleLabel(inferProfileRole(team.owner))}</span>
                </button>
                {team.profileMembers.length === 0 &&
                  team.workerPoolMembers.length === 0 && (
                    <div className="agents-team-empty">
                      No visible members yet.
                    </div>
                  )}
                {team.profileMembers.map((member) => (
                  <button
                    key={member.name}
                    className={`agents-team-member ${
                      activeProfile === member.name ? "active" : ""
                    }`}
                    onClick={() => handleSelect(member.name)}
                  >
                    <span>{member.name}</span>
                    <span>{roleLabel(inferProfileRole(member))}</span>
                  </button>
                ))}
                {team.workerPoolMembers.map((member) => (
                  <div
                    key={member.id}
                    className="agents-team-member agents-team-member-static"
                    title={member.path}
                  >
                    <span>{member.name}</span>
                    <span>{roleLabel(member.role)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {directorTeams.unassignedProfiles.length > 0 && (
        <section className="agents-panel agents-unassigned-section">
          <div className="agents-panel-header">
            <div className="agents-panel-title">
              Unassigned Agents
            </div>
            <span className="agents-panel-count">
              {directorTeams.unassignedProfiles.length} profiles
            </span>
          </div>
          <div className="agents-team-members">
            {directorTeams.unassignedProfiles.map((profile) => (
              <button
                key={profile.name}
                className={`agents-team-member ${
                  activeProfile === profile.name ? "active" : ""
                }`}
                onClick={() => handleSelect(profile.name)}
              >
                <span>{profile.name}</span>
                <span>{roleLabel(inferProfileRole(profile))}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default Agents;
