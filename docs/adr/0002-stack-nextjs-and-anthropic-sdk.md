# 0002. Next.js full-stack app on the Anthropic SDK

- **Status:** Accepted
- **Date:** 2026-11-20 (recorded 2026-11-23)

## Context

The brief asks for a full-stack AI learning agent with custom UI widgets (plan approval, MCQs, progress report) and doesn't prescribe a stack. We need one codebase with a rich client UI and server-side model calls, where API keys and answer keys stay on the server.

## Decision

- **Next.js (App Router) + TypeScript + Tailwind**: UI and API route handlers in one deployable app.
- **Official `@anthropic-ai/sdk`**, calling Claude directly. Structured outputs (Zod schemas) for plans, questions and reports; a hand-written streaming tool-use loop for the tutor.
- **Model:** `claude-opus-5-5` by default, overridable with `CLAUDE_MODEL`. `effort` is tuned per role (medium for content generation, low for the latency-sensitive tutor).
- **Server-side refusal fallbacks** (`fallbacks: "default"`, beta), so a classifier false positive on study material retries on a fallback model instead of dead-ending the lesson.

Alternatives considered:
- *Vercel AI SDK / LangGraph:* convenient abstractions for chat UIs and graphs, but they hide the API features we rely on (prompt caching placement, mid-conversation system messages, fallbacks), and the flow here is deterministic enough not to need a graph framework.
- *Hosted agent platform (Managed Agents):* designed for long-running sandboxed agents. Our agent is a short request/response tutor embedded in a web app, so owning the loop is simpler.

## Consequences

- Full control over prompts, caching and the tool loop; we write the loop ourselves (about 50 lines).
- Relies on beta features (fallbacks) that may change shape.
- Next 16 defaults (Cache Components) require Suspense boundaries for per-request pages (see `lesson/[id]/loading.tsx`).
