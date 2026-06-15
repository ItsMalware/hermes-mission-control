import { describe, expect, it } from "vitest";
import {
  buildDirectorTeamGroups,
  inferProfileRole,
  roleLabel,
  teamKeyForProfile,
} from "../src/renderer/src/screens/Agents/team-groups";

describe("agent team grouping", () => {
  it("uses director profiles as team owners and groups matching profile members", () => {
    const result = buildDirectorTeamGroups([
      {
        name: "intel-hub-director",
        isDefault: false,
        provider: "google-gemini-cli",
        role: "director",
        teamMembers: [
          {
            id: "intel:network",
            name: "network-traffic-analyst",
            role: "specialist",
            source: "worker-pool",
            path: "/pool/intel-hub-manager.md",
          },
        ],
      },
      {
        name: "intel-hub-worker-dev",
        isDefault: false,
        provider: "anthropic",
        role: "worker",
      },
      {
        name: "founder-assistant",
        isDefault: false,
        provider: "gemini",
        role: "assistant",
      },
    ]);

    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].owner.name).toBe("intel-hub-director");
    expect(result.teams[0].profileMembers.map((member) => member.name)).toEqual(
      ["intel-hub-worker-dev"],
    );
    expect(
      result.teams[0].workerPoolMembers.map((member) => member.name),
    ).toEqual(["network-traffic-analyst"]);
    expect(result.unassignedProfiles.map((profile) => profile.name)).toEqual([
      "founder-assistant",
    ]);
  });

  it("collapses duplicate director profiles that declare the same team", () => {
    const result = buildDirectorTeamGroups([
      {
        name: "osmara-director",
        isDefault: false,
        provider: "google-gemini-cli",
        role: "director",
        team: "osmara",
      },
      {
        name: "osmara-intel",
        isDefault: false,
        provider: "google-gemini-cli",
        role: "director",
        team: "osmara",
      },
      {
        name: "osmara-signal-scout",
        isDefault: false,
        provider: "google-gemini-cli",
        role: "specialist",
        team: "osmara",
      },
    ]);

    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].label).toBe("Osmara");
    expect(result.teams[0].owner.name).toBe("osmara-director");
    expect(result.teams[0].coDirectors.map((director) => director.name)).toEqual(
      ["osmara-intel"],
    );
    expect(result.teams[0].profileMembers.map((member) => member.name)).toEqual(
      ["osmara-signal-scout"],
    );
    expect(result.unassignedProfiles).toHaveLength(0);
  });

  it("distinguishes director, worker, assistant, specialist, and general roles", () => {
    expect(
      inferProfileRole({
        name: "mcp-director",
        isDefault: false,
        provider: "",
      }),
    ).toBe("director");
    expect(
      inferProfileRole({
        name: "notion-worker-dev",
        isDefault: false,
        provider: "",
      }),
    ).toBe("worker");
    expect(
      inferProfileRole({
        name: "founder-assistant",
        isDefault: false,
        provider: "",
      }),
    ).toBe("assistant");
    expect(
      inferProfileRole({
        name: "research-librarian",
        isDefault: false,
        provider: "",
      }),
    ).toBe("specialist");
    expect(
      inferProfileRole({ name: "default", isDefault: true, provider: "" }),
    ).toBe("general");
    expect(roleLabel("worker")).toBe("Worker/dev");
  });

  it("normalizes team keys without hardcoding team names", () => {
    expect(teamKeyForProfile("risk-hub-director")).toBe("risk-hub");
    expect(teamKeyForProfile("risk-hub-worker-dev")).toBe("risk-hub");
    expect(teamKeyForProfile("cozyhub-manager")).toBe("cozyhub");
  });
});
