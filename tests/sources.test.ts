import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { collectSources } from "@/lib/agent/sources";

type Block = Anthropic.Beta.BetaContentBlock;

describe("collectSources (ADR 0010: card sources must come from real search results)", () => {
  it("collects URLs from search result blocks and text citations", () => {
    const blocks = [
      {
        type: "web_search_tool_result",
        tool_use_id: "t1",
        content: [{ type: "web_search_result", url: "https://a.org/x", title: "A", encrypted_content: "", page_age: null }],
      },
      {
        type: "text",
        text: "fact",
        citations: [{ type: "web_search_result_location", url: "https://b.edu/y", title: "B", cited_text: "", encrypted_index: "" }],
      },
    ] as unknown as Block[];
    expect([...collectSources(blocks)]).toEqual([
      ["https://a.org/x", "A"],
      ["https://b.edu/y", "B"],
    ]);
  });

  it("ignores search errors and non-http(s) URLs", () => {
    const blocks = [
      { type: "web_search_tool_result", tool_use_id: "t1", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
      {
        type: "web_search_tool_result",
        tool_use_id: "t2",
        content: [{ type: "web_search_result", url: "javascript:alert(1)", title: "X", encrypted_content: "", page_age: null }],
      },
    ] as unknown as Block[];
    expect(collectSources(blocks).size).toBe(0);
  });
});
