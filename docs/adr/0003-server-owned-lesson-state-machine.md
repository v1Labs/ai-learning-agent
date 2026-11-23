# 0003. Server-owned lesson state machine

- **Status:** Accepted
- **Date:** 2026-11-20 (recorded 2026-11-23)

## Context

The brief's core problem is that general chatbots "lack a structured, persistent pedagogical flow". The required flow is fixed: plan → human approval → per-objective quiz loop → summary. If the LLM drives the flow freely (e.g. a single chat agent choosing what to do next), it can skip steps, lose its place, or end early.

## Decision

Model a lesson as an explicit state machine (`planning → awaiting_approval → learning → complete`) in `src/lib/lesson.ts`, owned by the server and persisted after every transition. Each transition is its own API endpoint. The LLM is called *within* steps to generate content (plan, question, hint, report) but never decides which step comes next.

Human-in-the-loop approval is a real phase: the learner can reorder or drop objectives, or send feedback that triggers a redraft, before learning begins.

Alternative considered: a single tool-calling chat agent that renders widgets as tool calls (the "generative UI" pattern). It feels more agentic, but it makes flow correctness depend on the prompt.

## Consequences

- The flow can't be skipped or derailed, and refreshing the page resumes exactly where the learner left off.
- Each step can be tested and evaluated in isolation.
- Less agent autonomy over the flow. Proactive or agentic behaviour (tutor nudges, discovery content) has to be designed in explicitly rather than emerging from the model.
