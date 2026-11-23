# AI Learning Agent

Turns a PDF into a structured, interactive lesson: the agent drafts a learning path, the learner approves it (human-in-the-loop), then works through a 10-question quiz with green/red feedback, escalating hints and a Socratic tutor. Correct answers earn XP; level-ups award collectible **discovery cards** researched from the web. It finishes with a progress report and study tips.

## Running it

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

## Deploying to Vercel

Local development needs only `ANTHROPIC_API_KEY`. A shared deployment also needs storage and spend protection (ADRs 0019, 0020):

1. **Import the repo** into Vercel (framework preset: Next.js).
2. **Add storage** from the project's *Storage* tab:
   - **Upstash Redis** (Marketplace): sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Lessons, locks and rate-limit counters live here.
   - **Vercel Blob**: sets `BLOB_READ_WRITE_TOKEN`. PDFs upload straight from the browser as private blobs.
3. **Set environment variables** (*Settings → Environment Variables*). Never commit these:
   - `ANTHROPIC_API_KEY`: ideally a key from a dedicated Console workspace.
   - `ACCESS_CODE`: the shared code your team will enter.
4. **Set a monthly spend limit** on that key's workspace in the Anthropic Console: the backstop if the link leaks.
5. **Deploy**, then run one full lesson end to end to exercise Redis and Blob.

Routes that call the model use `maxDuration = 300`, so the plan must allow 300s functions (Fluid compute). Background quiz and card generation normally finishes in about 45s.

## Testing

```bash
npm test             # unit tests (no API calls, ~100ms)
npm run typecheck
EVAL_PDF=./chapter.pdf npm run eval   # model evals: answer-key validity + tutor leakage (billed)
```

Unit tests cover grading, the answer-key projection, XP/levels and card scheduling (ADR 0017). CI runs lint, typecheck, tests and a build on every push. The evals check the two riskiest model behaviours against a real PDF and run on demand (ADR 0018).

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
    store.ts                     persistence: files locally, Redis + Blob when deployed; locks, leases, counters
    limits.ts                    upload caps and rate limits
    access.ts                    shared access-code helpers (gate in src/proxy.ts)
    claude.ts                    client, shared params, PDF block
    agent/                       planner, quizmaster, cardwriter, tutor, reporter
scripts/simulate-xp.py           evidence for the level thresholds (ADR 0007)
docs/adr/                        architecture decision records
```

## Known limitations / next steps

- Storage is a file store locally and Upstash Redis + private Vercel Blob when deployed (ADR 0019). Postgres is the long-term home (ADR 0015).
- The first question waits for its objective's generation call (~20s after approval). Objective 1 could be generated first or at lower effort.
- Uploads are capped at 100 pages (`MAX_PDF_PAGES`); whole books must be split into chapters first. ADR 0012 proposes automatic sectioning for large books.
- No per-user auth: a shared access code gates the deployment (ADR 0020), and lesson IDs are unguessable. ADR 0015 proposes profiles, a dashboard and lifetime XP and cards.
- An output-side guard on tutor replies (e.g. a cheap classifier checking for answer disclosure) would add defence in depth.
- Adaptive difficulty (step up or down based on first-try accuracy) and spaced-repetition review of missed concepts.
- Evals cover answer keys and tutor leakage; card spoilers and plan quality would follow the same pattern.
