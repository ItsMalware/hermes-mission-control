import { describe, expect, it, vi } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";

const { TEST_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os");
  return {
    TEST_HOME: path.join(os.tmpdir(), `hermes-artifacts-${Date.now()}`),
  };
});

vi.mock("electron", () => ({
  shell: {
    showItemInFolder: vi.fn(),
  },
}));

vi.mock("../src/main/installer", () => ({
  HERMES_HOME: TEST_HOME,
}));

import {
  listArtifactBuckets,
  listArtifactFiles,
  readArtifactText,
  resolveArtifactPath,
} from "../src/main/artifacts";

function writeFileUnder(...parts: string[]): string {
  const filePath = join(...parts);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, "hello artifact");
  return filePath;
}

describe("artifact bucket path validation", () => {
  it("lists files from known Hermes roots", () => {
    writeFileUnder(TEST_HOME, "goals", "demo", "index.html");

    const goals = listArtifactFiles("goals");

    expect(goals.some((file) => file.relPath === "demo/index.html")).toBe(true);
  });

  it("returns bucket metadata without exposing missing roots as files", () => {
    writeFileUnder(TEST_HOME, "images", "render.png");

    const buckets = listArtifactBuckets();
    const images = buckets.find((bucket) => bucket.id === "images");

    expect(images?.fileCount).toBeGreaterThanOrEqual(1);
    expect(images?.roots).toContain(join(TEST_HOME, "images"));
  });

  it("blocks traversal out of a bucket root", () => {
    writeFileUnder(TEST_HOME, "goals", "safe.txt");
    writeFileUnder(TEST_HOME, "secret.txt");

    expect(resolveArtifactPath("goals", "../secret.txt")).toBeNull();
    expect(readArtifactText("goals", "../secret.txt")).toBeNull();
  });

  it("blocks sibling directory prefix tricks", () => {
    writeFileUnder(TEST_HOME, "goals-evil", "secret.txt");

    expect(resolveArtifactPath("goals", "../goals-evil/secret.txt")).toBeNull();
  });

  it("truncates large text previews", () => {
    const filePath = join(TEST_HOME, "pastes", "large.log");
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, "x".repeat(1024 * 1024 + 10));

    const preview = readArtifactText("pastes", "large.log");

    expect(preview?.truncated).toBe(true);
    expect(preview?.content.length).toBe(1024 * 1024);
  });
});
