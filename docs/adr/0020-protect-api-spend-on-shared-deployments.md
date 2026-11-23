# 0020. Protect API spend on shared deployments: access code, rate limits, spend cap

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

A public URL plus our API key means anyone who finds the link can run up charges: each new lesson triggers about 15 model calls (plan, 10 questions across objectives, 3 researched cards, report), plus tutor turns. The demo is for a team, not the public, and we don't want sign-up friction ([0015](0015-learner-dashboard-and-persistent-profile.md) proposes accounts later).

## Decision

Three layers, from cheapest to strongest:

1. **Shared access code.** When `ACCESS_CODE` is set, `src/proxy.ts` (Next 16's replacement for middleware) gates every page and API route: pages redirect to `/access`, API calls get a 401. A correct code sets an HTTP-only, `Secure`, `SameSite=Lax` cookie holding a SHA-256 hash of the code (the code itself never sits in the browser), valid for 30 days. Guessing is limited to 10 attempts per IP per 15 minutes. Unset locally, so development is unaffected.
2. **Rate limits on lesson creation** (the expensive step): 10 lessons per IP per day and 100 in total per day, configurable via `MAX_LESSONS_PER_IP_PER_DAY` and `MAX_LESSONS_PER_DAY`. Counters live in the store (Redis when deployed, [0019](0019-deploy-on-vercel-with-redis-and-blob.md)). Rejected uploads don't count.
3. **A hard monthly spend limit** on the API key's workspace in the Anthropic Console: the backstop if everything else fails. This is a manual setup step, documented in the README.

Alternatives considered: Vercel Deployment Protection (password protection is a paid add-on, and Vercel Authentication requires reviewers to be on our Vercel team); real accounts (right later, too much friction now); no protection (unbounded cost exposure from a shared link).

## Consequences

- Verified on a production build: no code → redirect or 401; wrong code → 401; correct code → `HttpOnly; Secure; SameSite=Lax` cookie and access; the 11th guess is throttled; the 11th lesson from one IP is rejected with a clear message.
- A shared code can be forwarded. Acceptable for a demo; rotate `ACCESS_CODE` to revoke everyone at once.
- IP-based limits are coarse (shared office IPs share a budget). The daily total and the Console spend limit bound the worst case regardless.
