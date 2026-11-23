# 0013. Give the tutor a persona: "Sage", a study-buddy owl

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The tutor panel was labelled "Tutor" with plain grey bubbles. It read as a generic help widget, so learners have little reason to talk to it, and talking to it (hints, explanations) is part of what keeps people going instead of bouncing ([0007](0007-xp-and-levels.md)). The panel is also where the agent will become proactive (nudges, steering back to the lesson), and a nudge from a character lands better than one from a widget.

## Decision

- The tutor is **Sage**, a friendly owl: an avatar in the chat header and beside each message, a one-line tagline ("Your study buddy · hints, never answers"), an opening greeting that sets expectations, and a "Thinking…" state while it replies.
- **One source of truth**, `src/lib/persona.ts`, holds the name, greeting and personality. The UI reads it, and the tutor's system prompt is built from it, so what the learner sees and how the model talks can't drift apart.
- **Personality:** warm, curious and encouraging; celebrates effort and reasoning; light humour, never sarcasm. The greeting states the core rule up front ("I won't hand you answers, but I'll help you find them"), so declining to give answers feels in character rather than obstructive.
- **Honest about being an AI:** the prompt tells Sage to say plainly that it's an AI tutor if asked. The persona is a friendly framing, not an impersonation.
- The avatar is inline SVG: no image assets, and it themes with the rest of the UI.

Alternatives considered: no persona (lower engagement); a human-like name and photo (risks implying a real person); letting learners pick a tutor (fun, but scope we don't need yet).

## Consequences

- The tutor feels like a companion, giving the planned proactive nudges a natural voice.
- Changing the name or tone is a one-file edit. The greeting is part of the cached system prompt, so changing it costs one cache rebuild, which is negligible.
- A persona raises expectations of personality. Prompt tone should be checked in the tutor evals alongside answer leakage.
