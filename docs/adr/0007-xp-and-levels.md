# 0007. Gamify with XP and levels, tuned for 10-question completion

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The business goal (from the CEO) is to **reduce bounce and raise the share of learners who complete 10 questions**. That favours rewards that pay out immediately within one session. Mechanics that pay out over days (daily streaks, leaderboards) don't move this metric and add complexity.

Today a lesson has 3–6 objectives × 2 questions = 6–12 questions, so some lessons can't even reach 10. There's also no feedback on progress beyond a progress bar.

## Decision

**XP on every correct answer, weighted toward what we value.**

| | Beginner | Intermediate | Advanced |
|---|---|---|---|
| Correct answer (any attempt) | 10 | 15 | 20 |
| Unaided bonus: first try **and** no hints from the quiz or the tutor | +5 | +5 | +5 |

- Difficulty comes from the objective's tag in the approved plan. Objectives run from foundational to advanced, so XP per question grows through the lesson.
- XP is never deducted, and a correct answer after a retry still earns base XP. Penalties create frustration, and frustration causes bounce.
- Each correct answer shows its breakdown (e.g. "+15 XP · +5 unaided"), which teaches the rule without explaining it.

**Three levels, roughly at questions 2, 5 and 10. The first two flex with performance; the last is fixed.**
- **Level 1 at 25 XP:** the early win, always within the first 2–3 questions.
- **Level 2 at 70 XP:** lands around question 4–6, sooner for stronger learners.
- **Level 3 on completing the lesson (question 10):** tied to completion, not XP. An XP threshold would let strong learners reach it around question 7 (losing the pull to finish) or leave weaker learners short at 10. The CEO's metric is 10 questions, so the biggest reward lands exactly there for everyone.
- Each level-up grants a **discovery card** ([0008](0008-discovery-cards-as-level-up-rewards.md)), and the UI always shows "next card in N questions" (or N XP).

**Every lesson is 10 questions.** Lesson length becomes a fixed budget of 10 questions spread across the approved objectives (earlier objectives take any remainder), instead of 2 per objective. This depends on generating the quiz up front (a separate ADR when implemented).

**Instrument the funnel.** Record events (`lesson_started`, `question_answered` with its index, `level_up`, `card_revealed`) in the lesson record, so we can see where learners drop off and measure the effect of these mechanics.

Alternatives considered: flat XP per question (doesn't signal what we value); daily streaks (payout is too delayed for this metric); levels counted purely in questions (predictable, but doesn't reward doing well); an XP threshold for the final level (decouples the biggest reward from the completion target); penalties for hints or wrong answers (raise frustration).

## Evidence

`scripts/simulate-xp.py` runs 4,000 simulated learners per case over four lesson shapes (including a real anatomy plan) and three profiles: strong (85% unaided), average (55%) and hint-reliant (20%). Results show the question on which each level triggers (min–max across all cases):

| Threshold | Result | Verdict |
|---|---|---|
| 20 XP | Q1–Q2. A lesson that opens with intermediate questions hits it on Q1 (15 + 5 bonus) | Rejected: no "level up after 2" |
| **25 XP** | **Q2–Q3 in every case** (median Q2) | **Chosen for Level 1** |
| 60 XP | Q3–Q6. Hard-start lessons hit it on Q3 | Rejected: too early |
| **70 XP** | **Q4–Q6** (median Q4–Q6 depending on profile) | **Chosen for Level 2** |

## Consequences

- Every point in the lesson has a visible next reward: Q2–3, Q4–6, then Q10.
- Stronger and unaided learners level up a little sooner, which feels earned, while the completion reward is the same for everyone.
- Fixing the lesson at 10 questions changes how objectives are weighted (some get 1 question, others 3).
- Thresholds are two constants; we re-tune them with the funnel events and re-run the simulation if the XP table changes.
