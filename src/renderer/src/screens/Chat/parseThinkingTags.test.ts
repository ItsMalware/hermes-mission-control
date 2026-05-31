import { describe, it, expect } from "vitest";
import { parseThinkingTags } from "./MessageRow";

describe("parseThinkingTags", () => {
  it("handles empty or null content", () => {
    expect(parseThinkingTags("")).toEqual({ thinking: "", cleanContent: "" });
  });

  it("handles content without thinking tags", () => {
    expect(parseThinkingTags("hello world")).toEqual({
      thinking: "",
      cleanContent: "hello world",
    });
  });

  it("extracts a single closed think tag", () => {
    expect(parseThinkingTags("<think>working hard</think>done!")).toEqual({
      thinking: "working hard",
      cleanContent: "done!",
    });
  });

  it("extracts case-insensitive tags", () => {
    expect(parseThinkingTags("<Think>working hard</THINK>done!")).toEqual({
      thinking: "working hard",
      cleanContent: "done!",
    });
  });

  it("extracts different variants like thought, reasoning, thinking, REASONING_SCRATCHPAD", () => {
    expect(parseThinkingTags("<thought>my thought</thought>ok")).toEqual({
      thinking: "my thought",
      cleanContent: "ok",
    });
    expect(parseThinkingTags("<reasoning>logic here</reasoning>ok")).toEqual({
      thinking: "logic here",
      cleanContent: "ok",
    });
    expect(parseThinkingTags("<thinking>process</thinking>ok")).toEqual({
      thinking: "process",
      cleanContent: "ok",
    });
    expect(parseThinkingTags("<REASONING_SCRATCHPAD>scratch</REASONING_SCRATCHPAD>ok")).toEqual({
      thinking: "scratch",
      cleanContent: "ok",
    });
  });

  it("handles unclosed thinking tag (streaming case)", () => {
    expect(parseThinkingTags("<think>still processing")).toEqual({
      thinking: "still processing",
      cleanContent: "",
    });
  });

  it("handles multiple thinking tags by concatenating them with newlines", () => {
    expect(
      parseThinkingTags("<think>part 1</think> some middle text <think>part 2</think> final response")
    ).toEqual({
      thinking: "part 1\npart 2",
      cleanContent: " some middle text  final response",
    });
  });
});
