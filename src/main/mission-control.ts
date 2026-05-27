import { app } from "electron";
import { existsSync, lstatSync, readlinkSync, statSync } from "fs";
import { join } from "path";
import { HERMES_HOME, HERMES_REPO, HERMES_CONFIG_FILE } from "./installer";
import { getPublicConnectionConfig, listProfileSecrets } from "./config";
import { listProfiles, type ProfileInfo } from "./profiles";
import { readModels } from "./models";
import { listCachedSessions } from "./session-cache";
import {
  listBoards,
  listTasks,
  type KanbanBoard,
  type KanbanTask,
} from "./kanban";

export type MissionControlStatusState =
  | "LIVE"
  | "BUSY"
  | "DEGRADED"
  | "OFFLINE"
  | "UNKNOWN";

export interface MissionControlSubsystem {
  id: string;
  label: string;
  state: MissionControlStatusState;
  detail: string;
  count?: number;
  updatedAt: number;
}

export interface MissionControlStatus {
  generatedAt: number;
  app: {
    name: string;
    version: string;
    isLab: boolean;
  };
  paths: {
    hermesHome: string;
    hermesRuntime: string;
    hermesConfig: string;
    profiles: string;
    projectRoom: string;
  };
  subsystems: MissionControlSubsystem[];
  profiles: Array<{
    name: string;
    role: ProfileInfo["role"];
    state: MissionControlStatusState;
    provider: string;
    model: string;
    hasEnv: boolean;
    hasSoul: boolean;
    skillCount: number;
    gatewayRunning: boolean;
  }>;
  teams: Array<{
    key: string;
    label: string;
    directors: string[];
    members: number;
    goal: string;
    state: MissionControlStatusState;
  }>;
  secrets: {
    total: number;
    present: number;
    missing: number;
    duplicate: number;
    items: Array<{
      key: string;
      category: string;
      status: "present" | "missing" | "duplicate";
      profiles: string[];
      sources: string[];
    }>;
  };
  sessions: {
    totalCached: number;
    activeEstimate: number;
    latest: Array<{
      id: string;
      title: string;
      messageCount: number;
      model: string;
      startedAt: number;
    }>;
  };
  kanban: {
    boardCount: number;
    currentBoard: string | null;
    counts: Record<string, number>;
    topItems: Array<{
      id: string;
      title: string;
      status: string;
      priority: number;
      assignee: string | null;
    }>;
  };
  projectRoom: {
    pointer: string;
    target: string | null;
    exists: boolean;
    state: MissionControlStatusState;
  };
  connection: ReturnType<typeof getPublicConnectionConfig>;
}

const EXPECTED_SECRET_KEYS = [
  "NOTION_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GITHUB_TOKEN",
  "API_SERVER_KEY",
];

function now(): number {
  return Date.now();
}

function subsystem(
  id: string,
  label: string,
  state: MissionControlStatusState,
  detail: string,
  count?: number,
): MissionControlSubsystem {
  return { id, label, state, detail, count, updatedAt: now() };
}

async function withTimeout<T>(
  label: string,
  ms: number,
  fn: () => Promise<T> | T,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let timer: NodeJS.Timeout | null = null;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    });
    const value = await Promise.race([Promise.resolve().then(fn), timeout]);
    return { ok: true, value };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function teamKey(profileName: string): string {
  return profileName
    .replace(/-(director|manager|lead|dev|worker|review|researcher|content|analyst|librarian|ai-engineer|code-reviewer|bug-hunter|ux-guardian|ui-designer|repo-cleanup|content-strategist|brainstormer|signal-scout|fragrance-analyst|art-curator|neuroarts-editor|managing-editor|claim-guard|issue-architect)$/i, "")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function teamLabel(key: string): string {
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function getProjectRoomStatus(): MissionControlStatus["projectRoom"] {
  const pointer = join(HERMES_HOME, "project-room");
  if (!existsSync(pointer)) {
    return { pointer, target: null, exists: false, state: "OFFLINE" };
  }

  try {
    const stat = lstatSync(pointer);
    const target = stat.isSymbolicLink() ? readlinkSync(pointer) : pointer;
    const resolvedExists = existsSync(target) || existsSync(pointer);
    return {
      pointer,
      target,
      exists: resolvedExists,
      state: resolvedExists ? "LIVE" : "DEGRADED",
    };
  } catch {
    return { pointer, target: null, exists: false, state: "DEGRADED" };
  }
}

function buildSecretInventory(
  profiles: ProfileInfo[],
): MissionControlStatus["secrets"] {
  const byKey = new Map<
    string,
    {
      key: string;
      category: string;
      status: "present" | "missing" | "duplicate";
      profiles: Set<string>;
      sources: Set<string>;
    }
  >();

  for (const key of EXPECTED_SECRET_KEYS) {
    byKey.set(key, {
      key,
      category: key.split("_")[0] || "Other",
      status: "missing",
      profiles: new Set(),
      sources: new Set(),
    });
  }

  for (const profile of profiles) {
    const profileSecrets = listProfileSecrets(
      profile.isDefault ? undefined : profile.name,
    );
    for (const secret of profileSecrets) {
      const entry =
        byKey.get(secret.key) ||
        {
          key: secret.key,
          category: secret.category,
          status: "present" as const,
          profiles: new Set<string>(),
          sources: new Set<string>(),
        };
      entry.category = secret.category;
      entry.profiles.add(secret.profile);
      entry.sources.add(secret.source);
      entry.status = entry.sources.size > 1 ? "duplicate" : "present";
      byKey.set(secret.key, entry);
    }
  }

  const items = [...byKey.values()]
    .map((entry) => ({
      key: entry.key,
      category: entry.category,
      status:
        entry.profiles.size === 0
          ? ("missing" as const)
          : entry.sources.size > 1
            ? ("duplicate" as const)
            : ("present" as const),
      profiles: [...entry.profiles].sort(),
      sources: [...entry.sources].sort(),
    }))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.key.localeCompare(b.key),
    );

  return {
    total: items.length,
    present: items.filter((item) => item.status === "present").length,
    missing: items.filter((item) => item.status === "missing").length,
    duplicate: items.filter((item) => item.status === "duplicate").length,
    items,
  };
}

function summarizeKanban(
  boards: KanbanBoard[],
  tasks: KanbanTask[],
): MissionControlStatus["kanban"] {
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    counts[task.status] = (counts[task.status] || 0) + 1;
  }

  return {
    boardCount: boards.length,
    currentBoard: boards.find((board) => board.is_current)?.slug || null,
    counts,
    topItems: tasks
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
      })),
  };
}

export async function getMissionControlStatus(): Promise<MissionControlStatus> {
  const generatedAt = now();
  const projectRoom = getProjectRoomStatus();
  const profilesResult = await withTimeout("profiles", 2500, listProfiles);
  const profiles = profilesResult.ok ? profilesResult.value : [];
  const models = readModels();
  const sessions = listCachedSessions(200, 0);
  const boardsResult = await withTimeout("kanban boards", 8000, () =>
    listBoards(false),
  );
  const tasksResult = await withTimeout("kanban tasks", 8000, () =>
    listTasks({}),
  );
  if (!boardsResult.ok) {
    console.warn("[MC] kanban boards failed:", boardsResult.error);
  } else if (!boardsResult.value.success) {
    console.warn("[MC] kanban boards CLI error:", boardsResult.value.error);
  }
  const boards =
    boardsResult.ok && boardsResult.value.success && boardsResult.value.data
      ? boardsResult.value.data
      : [];
  const tasks =
    tasksResult.ok && tasksResult.value.success && tasksResult.value.data
      ? tasksResult.value.data
      : [];
  const profileItems = profiles.map((profile) => ({
    name: profile.name,
    role: profile.role,
    state:
      profile.model || profile.provider
        ? ("LIVE" as const)
        : ("DEGRADED" as const),
    provider: profile.provider || "unknown",
    model: profile.model || "unknown",
    hasEnv: profile.hasEnv,
    hasSoul: profile.hasSoul,
    skillCount: profile.skillCount,
    gatewayRunning: profile.gatewayRunning,
  }));
  const teams = [...profiles.filter((profile) => profile.role === "director")]
    .reduce<Map<string, MissionControlStatus["teams"][number]>>((map, profile) => {
      const key = profile.team || teamKey(profile.name);
      const existing =
        map.get(key) ||
        {
          key,
          label: teamLabel(key),
          directors: [],
          members: 0,
          goal: "",
          state: "LIVE" as MissionControlStatusState,
        };
      existing.directors.push(profile.name);
      existing.members += profile.teamMembers.length;
      // Use the first non-empty director description as the team goal
      if (!existing.goal && profile.description) {
        existing.goal = profile.description;
      }
      if (!profile.model && !profile.provider) existing.state = "DEGRADED";
      map.set(key, existing);
      return map;
    }, new Map());

  // Count profile-based workers (e.g. contract-hub-dev) into their teams
  for (const profile of profiles) {
    if (profile.role === "director" || profile.role === "general") continue;
    const key = profile.team || teamKey(profile.name);
    const team = teams.get(key);
    if (team) {
      team.members += 1;
    }
  }

  const teamItems = [...teams.values()];
  const secrets = buildSecretInventory(profiles);
  const runtimeExists = existsSync(HERMES_REPO);
  const configExists = existsSync(HERMES_CONFIG_FILE);
  const profilesPath = join(HERMES_HOME, "profiles");
  const cachePath = join(HERMES_HOME, "desktop", "sessions.json");
  const cacheMtime = existsSync(cachePath) ? statSync(cachePath).mtimeMs : 0;
  const kanbanFailure =
    (!boardsResult.ok && boardsResult.error) ||
    (!tasksResult.ok && tasksResult.error) ||
    (boardsResult.ok && !boardsResult.value.success && boardsResult.value.error) ||
    (tasksResult.ok && !tasksResult.value.success && tasksResult.value.error) ||
    "";

  const result: MissionControlStatus = {
    generatedAt,
    app: {
      name: app.getName(),
      version: app.getVersion(),
      isLab: app.getName().toLowerCase().includes("mission control"),
    },
    paths: {
      hermesHome: HERMES_HOME,
      hermesRuntime: HERMES_REPO,
      hermesConfig: HERMES_CONFIG_FILE,
      profiles: profilesPath,
      projectRoom: join(HERMES_HOME, "project-room"),
    },
    subsystems: [
      subsystem(
        "runtime",
        "Hermes Runtime",
        runtimeExists ? "LIVE" : "OFFLINE",
        runtimeExists ? HERMES_REPO : "Runtime folder missing",
      ),
      subsystem(
        "config",
        "Config",
        configExists ? "LIVE" : "DEGRADED",
        configExists ? HERMES_CONFIG_FILE : "Config file missing",
      ),
      subsystem(
        "profiles",
        "Profiles",
        profilesResult.ok
          ? profiles.length > 0
            ? "LIVE"
            : "DEGRADED"
          : "DEGRADED",
        profilesResult.ok ? `${profiles.length} profiles found` : profilesResult.error,
        profiles.length,
      ),
      subsystem(
        "sessions",
        "Session Cache",
        sessions.length > 0 ? "LIVE" : cacheMtime ? "DEGRADED" : "UNKNOWN",
        sessions.length > 0
          ? `${sessions.length} cached sessions`
          : "No cached sessions indexed",
        sessions.length,
      ),
      subsystem(
        "models",
        "Models",
        models.length > 0 ? "LIVE" : "UNKNOWN",
        `${models.length} saved models`,
        models.length,
      ),
      subsystem(
        "kanban",
        "Kanban",
        kanbanFailure
          ? "DEGRADED"
          : boards.length > 0 || tasks.length > 0
            ? "LIVE"
            : "UNKNOWN",
        kanbanFailure || `${boards.length} boards, ${tasks.length} tasks`,
        tasks.length,
      ),
      subsystem(
        "secrets",
        "Secrets",
        secrets.missing > 0 ? "DEGRADED" : "LIVE",
        `${secrets.present} present, ${secrets.missing} missing`,
        secrets.total,
      ),
      subsystem(
        "project-room",
        "Project Room",
        projectRoom.state,
        projectRoom.target || "Project Room pointer missing",
      ),
      subsystem(
        "updates",
        "Updates",
        "UNKNOWN",
        "Update state is reported by the existing app updater flow",
      ),
    ],
    profiles: profileItems,
    teams: teamItems,
    secrets,
    sessions: {
      totalCached: sessions.length,
      activeEstimate: sessions.filter(
        (session) => !session.startedAt || !session.title,
      ).length,
      latest: sessions.slice(0, 6).map((session) => ({
        id: session.id,
        title: session.title,
        messageCount: session.messageCount,
        model: session.model,
        startedAt: session.startedAt,
      })),
    },
    kanban: summarizeKanban(boards, tasks),
    projectRoom,
    connection: getPublicConnectionConfig(),
  };

  return result;
}
