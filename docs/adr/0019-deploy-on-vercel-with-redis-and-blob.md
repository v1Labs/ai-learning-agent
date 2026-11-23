# 0019. Deploy on Vercel with Upstash Redis and private Vercel Blob

- **Status:** Accepted (supersedes [0006](0006-file-backed-persistence.md) for deployed environments)
- **Date:** 2026-11-23

## Context

We're sharing the app with a team via Vercel. The prototype assumed one long-lived process with a disk (0006), and four things break on serverless:

1. **Storage:** the filesystem is ephemeral and requests land on different instances, so lessons would vanish mid-quiz.
2. **Locks and job tracking:** the per-lesson mutex and the "job in flight" set ([0009](0009-generate-quiz-up-front-in-background.md)) live in one process's memory.
3. **Uploads:** function request bodies are capped at about 4.5 MB; our test chapter is 14 MB.
4. **Time:** quiz and card generation take about 45s after the approval response, inside `after()`, which counts toward the function's duration.

## Decision

- **One store interface, two backends** (`src/lib/store.ts`). With Upstash env vars present: lessons in **Upstash Redis** (one JSON value per lesson, 30-day expiry), per-lesson **locks** as `SET NX PX` keys with owner-checked release (a Lua compare-and-delete), and job **leases** as expiring keys, so a background job runs at most once across instances. Without them, it uses the original file backend, so local development needs no setup.
- **PDFs in private Vercel Blob,** uploaded **directly from the browser** (`@vercel/blob/client`) with short-lived tokens from `/api/upload` that only allow PDFs up to 20 MB, with random names. Lesson creation then reads the blob server-side, re-validates it (magic bytes, page count from [0011](0011-cap-uploads-at-100-pages.md)), and deletes it if it's rejected. Private access means PDFs are only readable with the store's token, never by URL alone.
- **Time limits:** `maxDuration = 300` on routes that call the model or start background work. A small per-instance cache avoids re-downloading the PDF for every model call in a lesson.
- Upstash and Blob are provisioned from the Vercel dashboard (Marketplace / Storage), which sets their env vars automatically; `Redis.fromEnv()` reads either naming scheme.

Alternatives considered:
- *A host with a persistent disk (Railway, Render, Fly.io):* runs the current code nearly unchanged, but the team asked for Vercel.
- *Postgres:* the right long-term store (proposed in [0015](0015-learner-dashboard-and-persistent-profile.md)), but a document-per-lesson key-value store fits today's model with no schema work.
- *Public Blob URLs:* simpler, but uploaded study material would be readable by anyone who got the URL.
- *Streaming uploads through our API:* blocked by the body limit.

## Consequences

- The app runs on Vercel and locally with the same code; the store tests ([0017](0017-unit-tests-and-ci.md)) cover the shared contract on the file backend.
- The Redis backend is exercised only once deployed. Its logic is small (get/set, NX locks, counters), but the first deploy should include a full lesson run.
- Lock contention during plan drafting (up to ~60s) is handled by polling with backoff. Fine at demo scale, not for high concurrency.
- The 300s limit must be allowed by the Vercel plan (Fluid compute). Generation normally finishes well within it, and `/generate` resumes anything cut off.
- **Update (same day):** newer Blob stores authenticate with Vercel OIDC (`BLOB_STORE_ID`, no read-write token). Reads and deletes work unchanged, but browser uploads need presigned URLs (`handleUploadPresigned` / `uploadPresigned`) instead of client tokens. `/api/upload` supports both, and `/api/health` reports which storage and Blob mode a deployment is using.
- Gotcha found while testing: with a proxy present, Next buffers request bodies and silently truncates past 10 MB, which broke local uploads. `experimental.proxyClientMaxBodySize` is raised to 25 MB.
