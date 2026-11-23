# 0015. Learner dashboard with a persistent profile: documents, stats, lifetime XP and cards

- **Status:** Proposed (not implemented)
- **Date:** 2026-11-23

## Context

Today each lesson is an island. Learners reach it by URL, XP and cards reset with every lesson, and there's no place to see past work, resume a lesson, or upload another document. Per-lesson rewards ([0007](0007-xp-and-levels.md), [0008](0008-discovery-cards-as-level-up-rewards.md)) target **bounce and completion within a session**. A home base targets the next goal: **coming back**. 0008 deferred a lifetime card collection for lack of user identity, and [0012](0012-process-large-pdfs-in-sections.md) needs a place to show a book's sections.

## Decision (proposed)

**1. A profile per learner, anonymous first.**
- On first visit, create an anonymous profile and keep its ID in an HTTP-only cookie. No sign-up wall, since forced sign-up would raise the bounce we're trying to cut.
- Offer "save your progress" sign-up (magic link or OAuth) at natural moments, e.g. after the first level-up or on the progress report. Signing up attaches the anonymous profile to the account, so nothing is lost.
- Every document and lesson gets an `ownerId`. API routes check ownership, replacing today's "unguessable ID" model.

**2. Dashboard (`/`, once a profile has lessons).**
- **Documents and lessons:** a card per document showing its status (drafting plan / awaiting approval / X of 10 / complete), first-try accuracy, cards earned, and a primary action (Resume, Review plan, View report). Actions: upload, start a **new quiz from the same document** (fresh questions), rename, delete.
- **High-level stats:** lessons completed, questions answered, first-try accuracy, lifetime XP and level, cards collected, and the objectives to review most (from missed questions and hint use). All of these come from the existing lesson event log (0007), so no new tracking is needed.
- **Collection:** every card earned, grouped by document and filterable by angle (Origin story / In the real world / Big picture). Locked placeholders show what's left in in-progress lessons.

**3. Two XP layers, so lifetime progress doesn't break the per-lesson tuning.**
- **Lesson levels stay exactly as tuned** (0007: 25 XP / 70 XP / completion, a card each). They remain the session payoff.
- **Lifetime XP** is the sum across lessons and drives a **profile rank** with widening thresholds (e.g. 200 / 500 / 1,000 / 2,000 XP), shown on the dashboard and in the header. A rank-up is celebrated on the dashboard, not mid-quiz, so it never competes with the lesson's own level-up.
- **XP is earned once per question.** "New quiz from the same document" generates new questions; a review mode over already-answered questions would earn no XP, which prevents farming.

**4. Data model and storage (supersedes [0006](0006-file-backed-persistence.md) when built).**
- `Profile` 1–N `Document` (the uploaded PDF, in object storage such as S3 or Vercel Blob) 1–N `Lesson`. With 0012, `Document` 1–N `Section` 1–N `Lesson`.
- Lesson state moves into Postgres, with the lesson record largely as it is today, plus an `events` table. Stats are SQL aggregates over events. Lifetime XP and cards are derived from lessons rather than stored separately, so they can't drift.
- New APIs: `GET /api/me` (profile and stats), `GET /api/documents`, `POST /api/documents/:id/lessons` (new quiz), `DELETE /api/documents/:id`.

**5. Privacy and deletion.** Learners upload their own material, so deleting a document removes the PDF, its lessons, cards and chat. Anonymous profiles inactive for a set period (e.g. 90 days) are purged.

Alternatives considered:
- *Require sign-up before the first lesson:* simpler identity, but it adds friction at exactly the moment we're optimising.
- *One global XP and level ladder:* lifetime progress would push lesson thresholds out of reach, breaking the completion tuning in 0007.
- *Daily streaks on the dashboard:* rejected in 0007 for the in-session metric, but a legitimate option here, since return visits are what streaks reward. Revisit once we're measuring retention.

## Consequences

- Turns single lessons into an ongoing product: a reason to return, a growing collection, and somewhere to manage material.
- Needs real infrastructure (a database, object storage, sessions, auth), which is the bulk of the work. It's the natural moment to implement 0012 and the per-account limits that come with real users.
- Ownership checks close today's "anyone with the link" gap.
- Profile rank needs its own tuning; the same simulation approach as 0007 applies.

## Open questions

- What's on the dashboard for a first-time visitor with no lessons: the current upload hero, or sample lessons to try?
- Should cards from a deleted document stay in the collection (as keepsakes) or go with it? Deleting them is simpler and matches what learners expect from "delete".
