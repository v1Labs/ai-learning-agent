# 0011. Cap uploads at 100 pages, checked at upload

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

A tester uploaded a 767-page book. The upload succeeded, but planning failed: Claude accepts at most 600 PDF pages per request, and the API's 400 surfaced as an unhelpful "AI service error (400)" with the lesson stuck in `planning`. [0005](0005-native-pdf-input-with-prompt-caching.md) already noted that whole textbooks would be slow and costly.

## Decision

- Count pages at upload with `pdf-lib` (about 30–60ms) and reject PDFs over **100 pages** (`MAX_PDF_PAGES`) with a message suggesting the learner export one chapter. Unreadable or password-protected PDFs are rejected with their own message.
- Show the API's own reason when it rejects a request (`BadRequestError`) instead of a bare status code.

Why 100, not Claude's 600: a 10-question lesson only needs a chapter's worth of material. Every lesson sends the document to 6+ model calls, and planning time grows with length. 100 pages covers chapters, papers and articles with room to spare.

Alternatives considered: accept up to 600 pages (slow, expensive planning for content the quiz can't cover); chunk large books and let the learner pick a chapter (a good future feature, but more scope than a prototype needs).

## Consequences

- Oversized uploads fail immediately with an actionable message instead of a confusing error after a wait.
- Learners with a whole book must split it themselves. A "pick a chapter" step is the natural follow-up if that's common. Proposed design: [0012](0012-process-large-pdfs-in-sections.md).
- Adds a small dependency (`pdf-lib`).
