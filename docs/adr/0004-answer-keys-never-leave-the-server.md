# 0004. Answer keys never leave the server; deterministic grading

- **Status:** Accepted
- **Date:** 2026-11-20 (recorded 2026-11-23)

## Context

The brief requires that the learner can ask for hints and to learn more, but "the agent must not give away the answer". A prompt instruction alone is a weak guarantee: models can be talked out of instructions, and any answer key sent to the browser is visible in dev tools.

## Decision

Enforce it structurally, in layers:

1. **Client projection.** The browser receives a `PublicQuestion` without the correct index, explanation or unrevealed hints. These are included only after the learner answers correctly.
2. **Deterministic grading.** `POST /answer` compares indices in code. No model call: instant, free, and it can't be argued with.
3. **The tutor model never sees the key.** Its per-turn context has the question, the choices, which options were already tried (all wrong), and the hint count. Hints come from a `get_hint` tool that releases escalating hints written when the question was generated.
4. **Prompt guardrails** as the last layer: decline to solve the question, offer a hint or explanation, steer back to the lesson.

## Consequences

- The tutor can't leak a key it doesn't have. The remaining risk is the tutor *solving* the question itself from the PDF, which layer 4 addresses and an eval should measure.
- The tutor can't confirm a right answer before it's submitted; only the grader can.
- Hints are fixed when the question is generated, so their quality depends on question generation (a candidate for validation; see follow-up work on answer-key checking).
