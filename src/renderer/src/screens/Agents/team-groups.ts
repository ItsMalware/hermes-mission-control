export type ProfileRole =
  | "director"
  | "worker"
  | "assistant"
  | "specialist"
  | "general";

export interface TeamMemberInfo {
  id: string;
  name: string;
  role: ProfileRole;
  source: "worker-pool";
  path: string;
}

export interface TeamProfileInfo {
  name: string;
  isDefault: boolean;
  provider: string;
  role?: ProfileRole;
  teamMembers?: TeamMemberInfo[];
}

export interface DirectorTeamGroup {
  id: string;
  key: string;
  label: string;
  owner: TeamProfileInfo;
  profileMembers: TeamProfileInfo[];
  workerPoolMembers: TeamMemberInfo[];
}

export interface DirectorTeamGroups {
  teams: DirectorTeamGroup[];
  unassignedProfiles: TeamProfileInfo[];
}

const ROLE_ORDER: Record<ProfileRole, number> = {
  director: 0,
  worker: 1,
  assistant: 2,
  specialist: 3,
  general: 4,
};

export function inferProfileRole(profile: TeamProfileInfo): ProfileRole {
  if (profile.role) return profile.role;

  const name = profile.name.toLowerCase();
  if (profile.isDefault || name === "default") return "general";
  if (name.includes("director") || name.includes("manager")) {
    return "director";
  }
  if (name.includes("worker") || name.includes("dev")) return "worker";
  if (name.includes("assistant")) return "assistant";
  return "specialist";
}

export function roleLabel(role: ProfileRole): string {
  if (role === "director") return "Director";
  if (role === "worker") return "Worker/dev";
  if (role === "assistant") return "Assistant";
  if (role === "specialist") return "Specialist";
  return "General";
}

export function teamKeyForProfile(name: string): string {
  let key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  while (
    /(?:^|-)(director|manager|lead|owner|worker|dev|assistant|specialist|agent)$/.test(
      key,
    )
  ) {
    key = key.replace(
      /(?:^|-)(director|manager|lead|owner|worker|dev|assistant|specialist|agent)$/,
      "",
    );
  }

  return key.replace(/^-+|-+$/g, "");
}

export function teamLabelFromKey(key: string): string {
  if (!key) return "General";
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (part === "mcp") return "MCP";
      if (part === "govcon") return "GovCon";
      if (part === "cozyhub") return "CozyHub";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function buildDirectorTeamGroups(
  profiles: TeamProfileInfo[],
): DirectorTeamGroups {
  const directors = profiles
    .filter((profile) => inferProfileRole(profile) === "director")
    .sort((a, b) => a.name.localeCompare(b.name));

  const assignedProfileNames = new Set<string>();
  const teams = directors.map((director) => {
    const key = teamKeyForProfile(director.name);
    assignedProfileNames.add(director.name);

    const profileMembers = profiles
      .filter((profile) => {
        if (profile.name === director.name) return false;
        if (inferProfileRole(profile) === "director") return false;
        return teamKeyForProfile(profile.name).startsWith(key);
      })
      .sort((a, b) => {
        const roleDelta =
          ROLE_ORDER[inferProfileRole(a)] - ROLE_ORDER[inferProfileRole(b)];
        return roleDelta || a.name.localeCompare(b.name);
      });

    for (const member of profileMembers) {
      assignedProfileNames.add(member.name);
    }

    return {
      id: director.name,
      key,
      label: teamLabelFromKey(key),
      owner: director,
      profileMembers,
      workerPoolMembers: director.teamMembers ?? [],
    };
  });

  const unassignedProfiles = profiles
    .filter((profile) => !assignedProfileNames.has(profile.name))
    .sort((a, b) => {
      const roleDelta =
        ROLE_ORDER[inferProfileRole(a)] - ROLE_ORDER[inferProfileRole(b)];
      return roleDelta || a.name.localeCompare(b.name);
    });

  return { teams, unassignedProfiles };
}
