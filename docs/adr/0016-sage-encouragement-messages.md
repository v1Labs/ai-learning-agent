# 0016. Sage sends short encouragement at key moments, triggered by game events

- **Status:** Proposed (not implemented)
- **Date:** 2026-11-23

## Context

The brief asks the agent to steer the learner toward completing the lesson. Our primary proactive layer is the **game mechanics**: XP on every answer, "next card in N XP", level-ups and the card reveal ([0007](0007-xp-and-levels.md), [0014](0014-staged-level-up-sequence-and-card-design.md)) pull the learner forward without them asking. Sage ([0013](0013-tutor-persona.md)) is reactive: it only speaks when spoken to. Encouragement from a character at the right moments adds an emotional layer on top of the mechanics, especially at the points where learners are most likely to give up.

## Decision (proposed)

**Game events trigger it; Sage gives it a voice.** The server already knows the moments that matter. On specific events, a short message from Sage appears in the chat panel (with a subtle unread dot if the panel is off-screen on mobile):

| Moment | Trigger | Example intent |
|---|---|---|
| Struggling | 2nd wrong attempt on one question | Normalise the struggle, offer a hint or a different angle |
| Streak | 3 unaided correct answers in a row | Name the skill they're showing |
| Close to a reward | Next answer will level up | "One more and you unlock your next card" |
| Over the hump | Halfway (question 5) | Progress framing, not pressure |
| Back from a break | Returning to an in-progress lesson | Welcome back, recap where they are |

**Templates first, model second.** Messages come from a small library of hand-written templates per moment, filled with lesson context (objective name, questions left). They're instant, free, and can't leak answers. An optional upgrade lets Sage personalise the line with a low-effort model call under the same no-answer guardrails as the tutor ([0004](0004-answer-keys-never-leave-the-server.md)), falling back to the template on timeout.

**Restraint rules**, because encouragement that interrupts is worse than none:
- At most one proactive message per question, and never during a level-up sequence.
- Never on a correct first-try answer (the green highlight and XP are the reward).
- Struggle messages never mention the answer or narrow the options. They offer the existing `get_hint` path or a concept explanation.
- Messages are stored in the chat history, marked as proactive, so the tutor model sees what Sage already said.

Alternatives considered: model-generated messages on every answer (expensive, slow, and noisy); toasts over the quiz (compete with the green/red feedback and the level-up sequence); no encouragement (the mechanics alone already do the heavy lifting, so this stays an enhancement, not a fix).

## Consequences

- Adds warmth at drop-off points without adding latency (templates) or new safety risk.
- New event hooks in grading and a small template library; the chat UI already renders Sage's messages.
- Needs measuring: compare completion with and without encouragement using the funnel events, since too many messages could backfire.
