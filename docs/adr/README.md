# Architecture Decision Records

Lightweight ADRs ([Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)) recording *why* this project is built the way it is. Commit messages say *what* changed; ADRs say *why*, and what we gave up.

## Conventions

- One decision per file: `NNNN-short-title.md`, numbered in order, never renumbered.
- Keep each under a page. Copy [`template.md`](template.md).
- Status: `Proposed` → `Accepted` → (later) `Superseded by NNNN` or `Deprecated`. Don't rewrite an accepted ADR's decision; write a new one that supersedes it.
- Write the ADR in the same commit (or PR) as the change it describes.
- Record evidence where we have it (eval results, latency, cost) under Consequences.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-stack-nextjs-and-anthropic-sdk.md) | Next.js full-stack app on the Anthropic SDK | Accepted |
| [0003](0003-server-owned-lesson-state-machine.md) | Server-owned lesson state machine | Accepted |
| [0004](0004-answer-keys-never-leave-the-server.md) | Answer keys never leave the server; deterministic grading | Accepted |
| [0005](0005-native-pdf-input-with-prompt-caching.md) | Send the PDF to Claude natively, with prompt caching | Accepted |
| [0006](0006-file-backed-persistence.md) | File-backed persistence for the prototype | Accepted |
| [0007](0007-xp-and-levels.md) | Gamify with XP and levels, tuned for 10-question completion | Accepted |
| [0008](0008-discovery-cards-as-level-up-rewards.md) | Discovery cards from web research as level-up rewards | Accepted |
| [0009](0009-generate-quiz-up-front-in-background.md) | Generate the whole quiz up front, in the background | Accepted |
| [0010](0010-discovery-card-scheduling-and-research.md) | Schedule each card's topic at approval; research in two steps | Accepted |
| [0011](0011-cap-uploads-at-100-pages.md) | Cap uploads at 100 pages, checked at upload | Accepted |
| [0012](0012-process-large-pdfs-in-sections.md) | Process large PDFs as a table of contents plus ≤100-page sections | Proposed |
| [0013](0013-tutor-persona.md) | Give the tutor a persona: "Sage", a study-buddy owl | Accepted |
| [0014](0014-staged-level-up-sequence-and-card-design.md) | Stage the level-up as one continuous sequence; redesign cards | Accepted |
