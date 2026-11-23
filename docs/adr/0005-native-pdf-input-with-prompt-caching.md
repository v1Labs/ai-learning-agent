# 0005. Send the PDF to Claude natively, with prompt caching

- **Status:** Accepted
- **Date:** 2026-11-20 (recorded 2026-11-23)

## Context

Every model call in a lesson (plan, each question, tutor turns, report) needs the document. Study material often relies on tables, diagrams and layout that plain-text extraction loses. Re-sending a 40-page PDF on every call is slow and expensive.

## Decision

- Send the PDF to Claude as a native `document` content block, with no extraction step or vector store.
- Mark it for **prompt caching**. Planner, quiz generator and reporter share a byte-identical system prompt followed by the PDF, so they share one cached prefix. Task-specific instructions come *after* the PDF.
- The tutor has its own cached prefix (tools → system → PDF → chat history) and receives per-turn lesson state as a **mid-conversation system message**, which doesn't invalidate the cache.
- Limit uploads to 20 MB (base64 adds about a third; API requests are capped at 32 MB).

Alternative considered: extract text and use retrieval (RAG). That suits documents too large for the context window, but loses figures and adds infrastructure that a single chapter-sized PDF doesn't need.

## Consequences

- The model sees figures and tables, and setup has no pipeline.
- After the first call, the PDF is read from cache at a fraction of the cost.
- Very long documents (whole textbooks) will be slow and costly. Chunking or retrieval would be needed for those.
