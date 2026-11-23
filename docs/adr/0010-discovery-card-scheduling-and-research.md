# 0010. Schedule each card's topic at approval; research in two steps

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

[0008](0008-discovery-cards-as-level-up-rewards.md) decided that level-ups award web-researched discovery cards, pre-generated so the payout is immediate. Implementing it raised three questions: what each card is about (levels 1–2 are XP-based, so we can't know in advance exactly which question triggers them), how to stop a card spoiling a question still to come, and how to get structured cards with trustworthy sources.

## Decision

**Topic and angle fixed at approval.** Each level's card covers the objective holding the question the level usually lands on: level 1 → question 2, level 2 → question 5, level 3 → the final objective (see 0007's simulation). Each level gets a different angle, so the collection feels varied: **Origin story**, **In the real world**, **Big picture**.

**Spoiler guard.** A level can trigger mid-objective (e.g. at question 2 of a 3-question objective). So each card is written *after* its objective's questions exist, and the card writer gets those question stems with an instruction not to use facts that help answer them. Locked cards show no content at all.

**Two-step research.**
1. *Research*: Claude with the web search server tool (`max_uses: 4`, `pause_turn` handled) writes free-form notes.
2. *Format*: a structured-output call turns the notes into a card. The source URL must exactly match a URL the search actually returned, checked in code, so a model can't invent a citation.

Two steps are needed because structured outputs can't be combined with the citations web search produces. The research step gets the objective, not the PDF, which keeps it cheap. The PDF is used only by the fallback.

**Fallback.** On any failure or a 90-second timeout, the card is written from the PDF alone and labelled "From your document". A level-up therefore never shows an error. If a learner levels up before their card is ready, it shows "Researching…" and the client polls.

**Instrumentation.** The `card_revealed` event from 0007 is logged as `card_awarded` at level-up, with whether the card was ready and whether it came from the web.

## Consequences

- Measured on the anatomy PDF: **all 3 cards ready about 43 seconds after approval, all web-sourced** (nobelprize.org, NCBI, ScienceDirect). A full play-through awarded cards at questions 2, 5 and 10, each already revealed.
- If a learner reaches level 1 within about 40 seconds of approval, they'll briefly see "Researching…". That's unlikely: questions are ready around 24 seconds in, and answering two takes longer than the gap.
- The spoiler guard relies on an instruction, not a guarantee. An eval should check cards against their objective's answer keys.
- About six extra model calls per lesson (research and format for each card).
