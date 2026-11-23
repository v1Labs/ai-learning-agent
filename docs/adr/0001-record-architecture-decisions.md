# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

This is a take-home project that will be iterated on and then reviewed. Reviewers care about the judgement behind the design as much as the code, and that reasoning gets lost in chat and commit messages.

## Decision

Keep lightweight ADRs in `docs/adr/` using the Nygard format (Context, Decision, Consequences). One page maximum each, written alongside the change. Decisions made during the initial scaffold are backfilled as 0002–0006.

Alternatives considered: a single running `DECISIONS.md` (harder to supersede individual decisions, grows unwieldy); commit messages only (no place for alternatives and tradeoffs).

## Consequences

- The `docs/adr/` index doubles as the narrative of the project for the submission write-up.
- Small overhead per decision. Not every change needs an ADR, only ones with a real alternative or tradeoff.
