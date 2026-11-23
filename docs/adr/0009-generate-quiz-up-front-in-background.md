# 0009. Generate the whole quiz up front, in the background

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Questions were generated one at a time, just in time, so the learner waited several seconds before every question. That's dead time at exactly the moments we want momentum ([0007](0007-xp-and-levels.md)). The fixed 10-question lesson from 0007 also needs the lesson's shape decided up front.

## Decision

- **On approval**, allocate the 10 questions across the approved objectives (even split, earlier objectives take the remainder) and generate **all objectives in parallel, one model call per objective**. Generating an objective's questions together lets the model spread them across different concepts and avoid near-duplicates.
- **In the background:** the approval request returns immediately and the work runs in Next's `after()`. Model calls run outside the lesson lock, and results are merged in under it ([0006](0006-file-backed-persistence.md)).
- **The client polls** while the objective it needs is still generating. It shows the first question as soon as that objective is ready, with no wait between questions after that.
- **Idempotent and resumable:** `POST /generate` re-runs anything not finished or failed and skips work already in flight, so a server restart or a failed call is recoverable with a "Try again" button.
- Questions stay in server-side lesson state, never in the browser, so answer keys stay hidden ([0004](0004-answer-keys-never-leave-the-server.md)).

Alternatives considered: prefetching the next question while the learner reads the explanation (more moving parts, and still sequential); one call for all 10 questions (a single slow call and a single point of failure, and the first question waits for all of them).

## Consequences

- Measured on a 43-page anatomy PDF with 4 objectives: **all 10 questions ready about 24 seconds after approval**, objectives finishing in parallel between 18 and 24 seconds. After that there is no wait between questions.
- The first question still waits for its objective's call (up to ~24s). A follow-up could generate objective 1 first or with lower effort.
- Later questions can no longer adapt to performance. Adaptive bonus questions could be layered on later.
- Cost is spent up front, including for learners who bounce. The cached PDF keeps that to one cache write plus cheap cache reads.
- In-flight tracking is per process, consistent with the single-instance prototype (0006).
