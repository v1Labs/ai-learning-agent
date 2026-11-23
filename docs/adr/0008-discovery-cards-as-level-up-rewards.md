# 0008. Discovery cards from web research as level-up rewards

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Levels ([0007](0007-xp-and-levels.md)) need a reward that feels worth earning, three times per lesson (roughly at questions 2, 5 and 10). We also want the agent to be proactive and less text-heavy, and to add discovery beyond the PDF. A collectible card that brings in an interesting fact from outside sources does both: the reward is itself learning content.

Constraints: the PDF remains the source of truth (questions and grading never use web content), the reward must feel immediate even though web search takes seconds to tens of seconds, and web pages are untrusted input.

## Decision

**Card content.** Each card is about an objective the learner has just completed. It has a title, one surprising, concrete fact (around 40 words), one line connecting it to what they just learned, and the source link and domain. Example for chess openings: a famous game won with the opening, or the trap that gave it its name.

**Generation.** A card-writer call uses Claude's web search server tool, with the PDF and the completed objective as context, and returns structured output. The source must be a URL actually returned by the search, never one the model invents.

**Pre-generated, so the payout is immediate.** Card generation starts in the background when the plan is approved (the card for each level is about the objectives completed by that level). By the time the learner levels up, the card is usually ready. A short card-reveal animation covers any remaining wait.

**Always pays out.** If web search fails or times out, the reward becomes a card based on the PDF alone ("From your document: …"). A level-up never shows an error.

**Collection.** A small card tray shows collected cards plus locked placeholders, with "next card in N questions". Locked cards show no content, so nothing can hint at an upcoming answer. Collections are per lesson for now, since there are no user accounts.

**Guardrails.**
- Cards are revealed only after the related questions are answered, and only cover completed objectives, so they can't leak answers.
- Web content only feeds the card writer, whose only output is structured text. It never reaches the tutor's instructions or question generation, which limits prompt injection.
- Cards are rendered as plain text and links, not HTML.
- If outside sources disagree with the PDF, the card says so ("Other sources note…") rather than overriding the PDF.

Alternatives considered: fetching on demand at level-up (wait of 10–30 seconds, so not an immediate payout); cards drawn from the PDF only (no discovery element); an open-ended "explore" chat (text-heavy, and not a reward).

## Consequences

- Rewards double as learning, and the collection gives a reason to reach the next level.
- Adds cost and latency per lesson (one web-search call per card). Pre-generating hides the latency but spends tokens even if the learner bounces early. Acceptable for 3 cards per lesson.
- Source quality varies by subject; we can't keep one domain allowlist for every topic. Cited sources plus the PDF fallback are the mitigation.

## Deferred

- One card per level for now. A pick-one-of-three choice adds engagement at 3× the cost; revisit once the funnel data shows whether cards drive completion.
- Collections are per lesson. A lifetime collection across lessons needs user identity; revisit with auth.
