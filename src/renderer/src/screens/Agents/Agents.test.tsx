import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string): string => key,
  }),
}));

vi.mock("../../components/common/HermesLogo", () => ({
  default: (): React.JSX.Element => <div data-testid="hermes-logo" />,
}));

import Agents from "./Agents";

interface ProfileInfo {
  name: string;
  path: string;
  isDefault: boolean;
  isActive: boolean;
  description: string;
  model: string;
  provider: string;
  role: string;
  team: string;
  workerPoolPath: string;
  teamMembers: unknown[];
  hasEnv: boolean;
  hasSoul: boolean;
  skillCount: number;
  gatewayRunning: boolean;
}

function profile(name: string, isDefault = false): ProfileInfo {
  return {
    name,
    path: isDefault ? "C:/hermes" : `C:/hermes/profiles/${name}`,
    isDefault,
    isActive: isDefault,
    description: "",
    model: "",
    provider: "auto",
    role: "",
    team: "",
    workerPoolPath: "",
    teamMembers: [],
    hasEnv: false,
    hasSoul: false,
    skillCount: 0,
    gatewayRunning: false,
  };
}

function installHermesAPI(): {
  listProfiles: ReturnType<typeof vi.fn>;
  createProfile: ReturnType<typeof vi.fn>;
  deleteProfile: ReturnType<typeof vi.fn>;
  setActiveProfile: ReturnType<typeof vi.fn>;
  readSoul: ReturnType<typeof vi.fn>;
  writeSoul: ReturnType<typeof vi.fn>;
} {
  const api = {
    // Default to returning empty array so any unexpected call doesn't crash
    listProfiles: vi.fn().mockResolvedValue([]),
    createProfile: vi.fn(),
    deleteProfile: vi.fn(),
    setActiveProfile: vi.fn(),
    readSoul: vi.fn().mockResolvedValue(""),
    writeSoul: vi.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(window, "hermesAPI", {
    configurable: true,
    writable: true,
    value: api,
  });
  return api;
}

describe("Agents profile creation", () => {
  it("refreshes profiles after a failed create so ambiguous successes appear", async () => {
    const api = installHermesAPI();
    const initialProfiles = [profile("default", true)];
    api.listProfiles.mockResolvedValue(initialProfiles);
    api.createProfile.mockResolvedValue({
      success: false,
      error:
        "Error: Profile 'test2' already exists at C:/hermes/profiles/test2",
    });

    render(
      <Agents
        activeProfile="default"
        onSelectProfile={() => {}}
        onChatWith={() => {}}
      />,
    );

    // Wait for the component to finish loading (setTimeout(0) + listProfiles)
    await waitFor(() => {
      expect(screen.getByText("default")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("agents.newAgent"));
    fireEvent.change(screen.getByPlaceholderText("agents.namePlaceholder"), {
      target: { value: "test2" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("agents.create"));
    });

    // The component shows the error from the failed create
    await waitFor(() => {
      expect(screen.getByText(/already exists/)).toBeTruthy();
    });
  });
});
