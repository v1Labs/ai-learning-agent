# 0017. Unit-test the deterministic core with Vitest; run checks in CI

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The app's guarantees live in deterministic code, not in prompts: grading and hint escalation, the answer-key projection ([0004](0004-answer-keys-never-leave-the-server.md)), the 10-question allocation and card schedule ([0007](0007-xp-and-levels.md), [0010](0010-discovery-card-scheduling-and-research.md)), and XP and level rules. They were verified by hand-run scripts during development, but nothing stopped a later change from silently breaking them, e.g. a refactor that leaks `correctIndex` into the public payload, or an XP tweak that moves level-ups away from questions 2/5/10.

## Decision

- **Vitest** unit tests in `tests/` for the pure modules: `gamification.ts`, `lesson.ts` (allocation, card scheduling, the cursor, grading, a full lesson play-through, funnel events, the public projection) and `agent/sources.ts`. No model calls, no network, about 100ms. `collectSources` moved into its own module so it can be tested without an API client.
- **Tests encode the decisions, not just the code.** A play-through asserts level-ups land on questions 2, 5 and 10 (the 0007 simulation), and projection tests assert answer keys, explanations and unrevealed hints never appear in the serialised client payload.
- **One source for thresholds:** the XP bar now imports `XP_LEVELS` instead of keeping its own copy.
- **GitHub Actions CI** on every push and pull request: lint, typecheck (`next typegen && tsc`), tests, production build. The build needs no API key.

Alternatives considered: Jest (more config for TypeScript/ESM; Vitest shares Vite's resolver and runs these tests in milliseconds); end-to-end browser tests with Playwright (valuable for the level-up sequence, but slower and flakier; the browser checks done during development are recorded in 0013 and 0014); testing model outputs in this suite (non-deterministic and billed, so it belongs in evals, see [0018](0018-model-evals.md)).

## Consequences

- 26 tests guard the core guarantees and run on every push.
- UI components and API routes aren't covered; their logic is thin over the tested modules. Playwright tests for the level-up sequence are a natural next step.
- `@types/node` moved to 24 (Vitest requires 22+); Node 24 is a current LTS that Vercel supports.
