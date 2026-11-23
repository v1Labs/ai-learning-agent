import type Anthropic from "@anthropic-ai/sdk";

// Pure helper, kept separate from cardwriter.ts so it can be unit-tested
// without constructing an API client.

/** URLs the search actually returned (result blocks and citations), mapped to page titles. */
export function collectSources(blocks: Anthropic.Beta.BetaContentBlock[]): Map<string, string> {
  const sources = new Map<string, string>();
  for (const b of blocks) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) sources.set(r.url, r.title);
    }
    if (b.type === "text") {
      for (const c of b.citations ?? []) {
        if (c.type === "web_search_result_location") sources.set(c.url, c.title ?? c.url);
      }
    }
  }
  // Only http(s) links are rendered.
  for (const url of sources.keys()) if (!/^https?:\/\//.test(url)) sources.delete(url);
  return sources;
}
