# 0022. Make prompt caching actually hit: 1-hour PDF TTL, one effort level, warm before fan-out

- **Status:** Accepted (refines [0005](0005-native-pdf-input-with-prompt-caching.md))
- **Date:** 2026-11-23

## Context

[0005](0005-native-pdf-input-with-prompt-caching.md) marks the PDF for prompt caching, but while testing the deployed app the Console showed little or no cache activity. Reviewing the call pattern turned up several ways the cache was being missed or rewritten:

- **Parallel fan-out:** after approval, every objective's quiz call started at once. A cache entry can only be read once the request writing it has started responding, so 3–6 concurrent calls each paid the full PDF write (1.25×) and none read the others' entries.
- **Mixed effort:** the planner and quizmaster used `medium` effort, while the reporter and the PDF-only card fallback used `low`. Effort is rendered into the prompt, so a change of effort invalidates the cached messages (where the PDF lives).
- **5-minute TTL vs lesson length:** plan review, a 10-question quiz and the report span well over 5 minutes, and the tutor is used sporadically. Each gap over 5 minutes meant another full write.
- **Tutor history:** the only breakpoint was the PDF, so the growing chat history was reprocessed on every turn.
- **No visibility:** nothing logged `cache_creation_input_tokens` / `cache_read_input_tokens`, so there was no way to tell hits from misses without the Console.

## Decision

1. **1-hour TTL on the PDF block** (`cache_control: { type: "ephemeral", ttl: "1h" }`). Writes cost 2× instead of 1.25×, but one write then covers the whole lesson, including the report and tutor turns after long pauses. Reads refresh the timer at no cost.
2. **One effort level for every call sharing the system → PDF prefix** (`COURSE_DESIGNER_EFFORT = "medium"`): planner, quizmaster, reporter and PDF card fallback. Web-research card calls don't include the PDF, so their effort settings stay as they were.
3. **Warm before fan-out:** generate the first objective's questions alone, then the rest in parallel. The learner starts on the first objective, so time to first question doesn't change. The other objectives finish one call later, while the learner is answering.
4. **Tutor history breakpoint:** a 5-minute breakpoint on the newest learner message, after the PDF's 1-hour one (longer TTLs must come first). The per-turn lesson-state system message stays after it, so it never breaks the prefix.
5. **Log usage per call** (`[claude] <label>: input=… cache_write=… cache_read=… output=…`) so hits can be checked in local or Vercel logs.

Alternatives considered:
- *Keep the 5-minute TTL and re-warm with `max_tokens: 0`:* not possible for structured-output calls (`output_config.format` rejects `max_tokens: 0`), and it adds a timer per lesson. The 1-hour TTL is simpler.
- *A separate warm-up request before the fan-out:* an extra call. The first real objective call does the same job and its output is used.
- *Share one cached prefix between the tutor and the course-designer calls:* their tools and system prompts differ. Merging them would mean restructuring the tutor, which is too big a change for this tuning pass.

## Consequences

- Expected per lesson: one 2× write of the course-designer prefix and one of the tutor prefix, then cache reads (0.05× on Opus 5.5) for every other call. Before, that was 3–6 writes at fan-out plus rewrites after each pause.
- The reporter and card fallback now run at `medium` effort, so they produce slightly more output tokens. That is small next to the PDF input they now read from cache.
- Objectives after the first are ready about one call (~15–20s) later than before.
- Not yet measured end to end. The usage log lines are the check: after one lesson, `cache_read` should be non-zero on every call after the first in each prefix.
