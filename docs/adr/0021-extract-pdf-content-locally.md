# 0021. Extract PDF content locally and send text (plus selected page images) instead of the raw PDF

- **Status:** Proposed (not implemented; would supersede [0005](0005-native-pdf-input-with-prompt-caching.md) if accepted)
- **Date:** 2026-11-23

## Context

[0005](0005-native-pdf-input-with-prompt-caching.md) sends the raw PDF to Claude on every call. With native PDF input, each page is processed as **extracted text plus an image of the page**, so a page costs roughly 1.5–3k input tokens, while the same page as plain text is typically a few hundred tokens. A lesson makes about 15 calls that include the document (plan, quiz per objective, card fallbacks, report, tutor turns).

Prompt caching already softens this: after the first call, cached reads cost about 10% of the normal input price. But at scale the document size still drives cost:

- **Cache writes** (1.25× the input price) happen per lesson, and again whenever the 5-minute cache expires (e.g. a learner pauses mid-lesson).
- **Separate prefixes:** the tutor has its own cached prefix (tools and system prompt differ), so the document is written to cache at least twice per lesson.
- **Parallel calls race the cache:** the quiz calls for each objective start together, so several can pay full price before the first cache write lands.
- **Bandwidth and latency:** a 14 MB PDF is base64-encoded into every request, and larger inputs mean a slower time to first token.

Most study material is mostly text, so paying for a page image on every page is often wasted.

## Decision (proposed)

**Extract once at upload, store the result, and send the smallest faithful representation.**

1. **Extract server-side at upload** (e.g. `unpdf` / `pdfjs-dist`, pure JavaScript, no native dependencies) into per-page text with page markers (`<page n="12">…</page>`), keeping headings, lists and simple tables as Markdown where the layout allows. Store it alongside the PDF (Blob in production, [0019](0019-deploy-on-vercel-with-redis-and-blob.md)).
2. **Classify each page** by how much text it yields and how much of it is images:
   - *Text pages* are sent as text.
   - *Visual pages* (little extractable text, large figures, diagrams, chess boards, equations, scanned pages) are sent as page images (rendered once at upload) or as a small PDF of just those pages.
3. **Hybrid prompt:** one cached document prefix made of the page texts in order, with images inserted only for visual pages. Planner, quiz generator, card fallback, reporter and tutor all use the same representation.
4. **Keep native PDF as a per-lesson fallback** when extraction fails or the document is mostly visual (e.g. over 50% visual pages), so quality never drops below today's.
5. **Unlocks:** per-page text makes [0012](0012-process-large-pdfs-in-sections.md) (sectioning large books) and retrieval straightforward, and plain-text documents support citations with character locations, should we want questions to cite their source passage.

**Prove it before switching.** The ADR is accepted only if a side-by-side comparison on a small, varied PDF set (prose-heavy chapter, table-heavy guide, diagram-heavy chapter, a chess-openings document with board diagrams) shows:

- **Cost:** input tokens per lesson measured with the token-counting endpoint (`messages.count_tokens`) for both representations, plus real cache-write and cache-read usage from one full lesson each.
- **Quality:** the [0018](0018-model-evals.md) evals (answer-key validity at 90% or more, zero tutor leaks) pass on the extracted representation, and question quality doesn't regress on visual-heavy documents.
- **Latency:** time to first question after approval, for both modes.

Alternatives considered:
- *Files API, referencing the PDF by `file_id`:* removes the re-upload bandwidth, but tokens are billed the same, so it's complementary, not a substitute.
- *OCR for scanned PDFs* (e.g. Tesseract): adds native dependencies and its own error modes. Sending those pages as images lets Claude read them instead.
- *Text only, dropping images entirely:* cheapest, but loses diagrams, tables and figures that questions often depend on (e.g. chess positions, anatomy diagrams).
- *Retrieval over chunks:* reduces tokens further, but a 10-question lesson over one chapter benefits from the model seeing the whole chapter. Revisit for whole books (0012).

## Consequences

- If the measurements hold, the document portion of input cost drops severalfold for text-heavy material, with the largest effect on cache writes and cache misses.
- Extraction adds an upload step (seconds for a chapter) and a stored artefact per lesson, and page rendering for visual pages adds a dependency (e.g. a PDF renderer).
- Extraction quality varies (multi-column layouts, tables, ligatures), which is why the visual-page fallback and the evals are part of the decision rather than an afterthought.
- Two document representations exist during the trial; the switch is per lesson, so it can be rolled out and rolled back safely.
