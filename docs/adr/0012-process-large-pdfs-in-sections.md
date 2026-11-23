# 0012. Process large PDFs as a table of contents plus ≤100-page sections

- **Status:** Proposed (not implemented; the prototype keeps the 100-page cap from [0011](0011-cap-uploads-at-100-pages.md))
- **Date:** 2026-11-23

## Context

Real study material is often a whole book: a 700-page board-prep guide, a textbook, a manual. Today we reject anything over 100 pages. The hard limits on a single request are **600 PDF pages** and **32 MB**, and in practice each page costs roughly 1.5–3k tokens (text plus a page image), so a whole book in every call is slow and expensive. Yet a 10-question lesson only ever needs a chapter's worth of material.

## Decision (proposed)

Treat a large PDF as a **course** made of **sections** of up to 100 pages each. Every lesson is built from one section, so the existing pipeline (plan → approve → quiz → cards) runs unchanged on a ≤100-page document.

1. **Split on upload** (`pdf-lib`, server-side, no model calls):
   - Prefer the PDF's own **outline/bookmarks** to cut at chapter boundaries, merging small chapters and splitting oversized ones so each section is ≤100 pages.
   - Without an outline, fall back to fixed 100-page windows with a few pages of overlap, so a topic that straddles a boundary isn't lost.
   - Store each section as its own PDF with its page range in the original.
2. **Index each section** with a cheap model call (Claude Haiku 5.5, low effort, structured output): title, 2–3 sentence summary, main topics, and the page range of each topic. Sections are independent, so they run in parallel. For bulk or library-scale ingestion where nobody is waiting, use the **Message Batches API** (asynchronous, about half the cost).
3. **Learner picks a section** from a generated table of contents (human-in-the-loop, like plan approval), or the agent recommends where to start. A lesson then works exactly as today, with the section PDF as its document.
4. **Course-level progress:** finished sections are marked complete, and XP and discovery cards accumulate across the course, which also gives cards the lifetime collection deferred in [0008](0008-discovery-cards-as-level-up-rewards.md).
5. **Upload once:** send section PDFs through the **Files API** and reference them by `file_id`, instead of re-sending base64 in every call. This keeps requests small and stays clear of the 32 MB limit.

Alternatives considered:
- *Raise the cap toward 600 pages:* simplest, but every lesson call carries the whole book (slow and expensive), and the quiz can only cover a small fraction of it.
- *Text extraction plus retrieval (RAG):* scales to any size and suits search-style Q&A, but loses figures and tables and adds an embedding pipeline. Worth it only if lessons need to draw on many distant parts of a book at once.
- *Model-chosen splits:* ask Claude to find chapter boundaries. That needs the whole book in context, which is the problem we're avoiding; the outline plus page windows is free.

## Consequences

- Any book size works, while per-lesson cost and latency stay at today's ≤100-page levels. Indexing is a one-time cost per upload.
- New concepts: course, section, table of contents, and course-level progress. This needs real persistence ([0006](0006-file-backed-persistence.md)) and probably user accounts.
- Outline quality varies: scanned books often have none, so fixed windows with overlap carry more weight there.
- Questions only draw on one section. Cross-chapter review (e.g. an end-of-course quiz) would need per-section summaries or retrieval on top.

## Open questions

- Should the agent recommend the starting section from the learner's goal (e.g. "I have an exam on cardiology")?
- Generate lessons for every section up front, or only when a section is chosen? On-demand is cheaper; up front makes the course feel ready.
