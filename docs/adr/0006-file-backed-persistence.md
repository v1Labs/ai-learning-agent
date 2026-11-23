# 0006. File-backed persistence for the prototype

- **Status:** Accepted
- **Date:** 2026-11-20 (recorded 2026-11-23)

## Context

Lessons must persist across page reloads (see 0003). The prototype runs locally, as a single process, for one user.

## Decision

Store each lesson as `.data/lessons/<id>/lesson.json` plus `source.pdf`, behind a small repository module (`src/lib/store.ts`). Writes are atomic (write to a temp file, then rename). A per-lesson in-process lock serialises read-modify-write cycles, e.g. a double-clicked submit.

Alternative considered: SQLite or Postgres from day one. That's more setup than a prototype needs, and the repository module makes the swap cheap later.

## Consequences

- No infrastructure to set up, and lesson state is easy to inspect while debugging.
- **Does not work on serverless hosts** (e.g. Vercel), whose filesystems are ephemeral and which run multiple instances. The lock is per-process only. Deploying requires a hosted database and object storage for PDFs, recorded as a superseding ADR when we get there.
- No access control: lesson IDs are unguessable but anyone with the link can open the lesson.
