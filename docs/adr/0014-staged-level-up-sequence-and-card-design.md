# 0014. Stage the level-up as one continuous sequence; redesign cards

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The level-up modal opened the instant a correct answer came back. The learner never saw their green answer or "+XP" land, the XP bar jumped from nearly full back to near-empty (its new level's baseline), and the card appeared already revealed. QA described it as confusing and jarring. The level-up is the payoff that's meant to pull learners on to the next card ([0007](0007-xp-and-levels.md)), so it needs to feel like a reward, not an interruption. The cards were also visually plain.

## Decision

**One continuous sequence, each beat finishing before the next starts:**
1. **Answer lands (0–0.9s).** Green highlight, "+XP" chip, and the XP bar fills to 100% and glows with "Level up!". The level number and the new card's tray slot stay at their old state.
2. **Interrupt (0.9s).** The backdrop fades in, the "Level up!" headline pops, and the card slides up **face-down**: solid orange with its number.
3. **Reveal (about 2.1s).** After a beat, the card flips (3D, 700ms). If it's still being researched ([0010](0010-discovery-card-scheduling-and-research.md)), it stays face-down with a shimmer and flips the moment it's ready. The learner can continue regardless, and the button says so.
4. **Collect.** "Add to collection & keep going" flies the card into its tray slot (FLIP technique: measure both rects, animate the transform), the slot pops, and only then does the level number tick up and the bar reset for the next level.

**Card redesign:** a solid orange header holding a number badge, the angle label ("Origin story · 1 of 3") and the title; then the fact, a "↳" connection line, and a footer with the source and a level chip. The back is solid orange with a dot pattern and a large number. Tray slots become mini orange cards with their numbers.

**Accessibility:** with `prefers-reduced-motion`, every delay and animation is skipped and the card appears revealed. Escape closes the modal, and the faces carry the correct `aria-hidden` state.

Alternatives considered: a toast plus a tray badge (not disruptive, but too quiet for the main reward); a full-screen celebration (more jarring, not less); an animation library such as Framer Motion (a new dependency for what CSS transitions and the Web Animations API already cover).

## Consequences

- Verified in Chrome: bar holds at 100% with the level unchanged → modal with face-down card (including the "researching" state, which flips once polling sees the card is ready) → flip → card flies into its slot → slot pops and the level ticks up.
- The sequence adds about 2 seconds per level-up, 3 times per lesson. That's a deliberate pause on a reward, not dead time.
- The flip uses plain CSS classes in `globals.css` (3D transforms need `preserve-3d` and `backface-visibility` on specific elements), alongside Tailwind utilities.
- Timings are constants in `LessonView` and `CardModal`; they should be tuned with real learners.
