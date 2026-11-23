# AI Learning Agent

Turns a PDF into a structured, interactive lesson: the agent drafts a learning path, the learner approves it (human-in-the-loop), then works through a 10-question quiz with green/red feedback, escalating hints and a Socratic tutor. Correct answers earn XP; level-ups award collectible **discovery cards** researched from the web. It finishes with a progress report and study tips.

## Running it

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

## Flow

| Phase | What happens | Endpoint |
|---|---|---|
| `planning` | PDF uploaded; agent reads it and drafts objectives with difficulty | `POST /api/lessons`, `POST /api/lessons/:id/plan {action:"draft"}` |
| `awaiting_approval` | **HITL**: learner reorders or drops objectives and approves, or sends feedback for a redraft | `POST …/plan {action:"revise"\|"approve"}` |
| `learning` | All 10 questions and 3 discovery cards are generated in parallel in the background; the learner starts as soon as the first objective is ready | `POST …/generate` (resume/retry), `POST …/answer` |
| | Correct → green + explanation + XP → next. Incorrect → red + next hint → retry | |
| | Level-ups (about questions 2, 5 and 10) reveal a discovery card | |
| | Tutor chat on the side: explanations and hints, never answers | `POST …/chat` (streamed) |
| `complete` | Per-objective stats + Claude-written strengths, review areas, study tips | `POST …/report` |

## Design decisions

Each decision below has an Architecture Decision Record with context, alternatives and tradeoffs in [`docs/adr/`](docs/adr/README.md).

**The server owns the pedagogical flow.** Lesson state is an explicit state machine (`src/lib/lesson.ts`), persisted after every step (`src/lib/store.ts`). The LLM generates content but can't skip steps, and a page refresh resumes exactly where you left off. That persistent, structured flow is what the brief says ChatGPT-style learning lacks.

**Answers can't leak, by construction rather than by prompt.**
- Answer keys, explanations and unrevealed hints stay on the server. The browser gets a `PublicQuestion` projection that includes the correct index and explanation only after a correct answer.
- Grading is deterministic code, with no model call: it's instant and can't be argued with.
- The tutor model is **never given the answer key**. It sees the question and choices, which wrong options were already tried, and how many hints have been used. Its hints come from a `get_hint` tool that releases pre-written, escalating hints. The system prompt adds a second layer: refuse to solve the question and steer back to the lesson.

**Gamification tuned for completion.** The goal is more learners finishing 10 questions, so rewards pay out immediately: XP on every correct answer (more for harder questions, a bonus for unaided answers, never deducted) and three levels, each awarding a discovery card. The final level is tied to finishing the lesson. Thresholds were chosen by simulation (`scripts/simulate-xp.py`). Funnel events are logged per lesson.

**Discovery cards** bring in one surprising, sourced fact from beyond the PDF, researched with Claude's web search tool. Sources must come from the actual search results, cards can't spoil upcoming questions, and if research fails the card falls back to the PDF, so a level-up never errors.

**Agent decomposition.** Each role has a narrow job and its own prompt (`src/lib/agent/`):
- `planner.ts`: drafts and revises the plan (structured output, Zod schema).
- `quizmaster.ts`: generates an objective's questions in one call, each with an explanation and 2 escalating hints, and validates its own output (regenerates the shortfall if malformed).
- `cardwriter.ts`: researches a discovery card with web search, then formats it with a verified source (PDF fallback).
- `tutor.ts`: streaming tool-use loop for open-ended help, voiced by **Sage**, a study-buddy persona defined once in `src/lib/persona.ts` (ADR 0013).
- `reporter.ts`: the narrative report on top of deterministically computed stats.

**Claude API usage** (`@anthropic-ai/sdk`, `claude-opus-5-5`, overridable via `CLAUDE_MODEL`):
- The PDF goes to Claude natively as a `document` block, so tables, figures and layout are understood without a text-extraction step.
- **Prompt caching:** planner, quizmaster and reporter share a byte-identical system prompt with the PDF next, so the document is cached once per lesson and re-read cheaply on every question.
- **Mid-conversation system messages** carry per-turn lesson state into the tutor without invalidating the cached tools → system → PDF → history prefix.
- `effort` tuned per role: medium for planning and question writing, low for the latency-sensitive tutor and the report.
- **Server-side refusal fallbacks** (`fallbacks: "default"`): if a safety classifier falsely flags study material, the request is retried on a fallback model instead of dead-ending the lesson. Refusals are also handled explicitly.

## Project layout

```
src/
  app/
    page.tsx                     upload screen
    lesson/[id]/page.tsx         lesson screen (server-loads state)
    api/lessons/…                REST endpoints (one per transition)
  components/                    PlanReview (HITL), QuizWidget, TutorChat, ProgressReport, …
  lib/
    types.ts                     domain + public projections
    lesson.ts                    state machine, grading, stats
    gamification.ts              XP rules and levels
    jobs.ts                      background quiz + card generation
    store.ts                     file-backed persistence + per-lesson lock
    claude.ts                    client, shared params, PDF block
    agent/                       planner, quizmaster, cardwriter, tutor, reporter
scripts/simulate-xp.py           evidence for the level thresholds (ADR 0007)
docs/adr/                        architecture decision records
```

## Known limitations / next steps

- File-based store and an in-process lock: fine for a single-instance demo. Swap `store.ts` for Postgres/Redis to scale out.
- The first question waits for its objective's generation call (~20s after approval). Objective 1 could be generated first or at lower effort.
- Uploads are capped at 100 pages (`MAX_PDF_PAGES`); whole books must be split into chapters first. ADR 0012 proposes automatic sectioning for large books.
- No auth; lesson IDs are unguessable but not access-controlled.
- An output-side guard on tutor replies (e.g. a cheap classifier checking for answer disclosure) would add defence in depth.
- Adaptive difficulty (step up or down based on first-try accuracy) and spaced-repetition review of missed concepts.
- Evals: a small set of PDFs plus rubric-graded checks on plan quality, question validity, tutor answer leakage, and discovery cards spoiling questions.
