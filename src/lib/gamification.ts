// XP and levels (ADR 0007). Pure functions so they're easy to test and to
// mirror in scripts/simulate-xp.py.
import type { Difficulty, Question, XpAward, XpProgress } from "./types";

export const XP_BASE: Record<Difficulty, number> = { beginner: 10, intermediate: 15, advanced: 20 };
export const UNAIDED_BONUS = 5;

/** Levels 1-2 are XP thresholds; the final level is completing the lesson. */
export const XP_LEVELS = [
  { level: 1, xp: 25 },
  { level: 2, xp: 70 },
] as const;
export const COMPLETION_LEVEL = 3;

/** XP for a question just answered correctly. Unaided = first try and no hints (quiz or tutor). */
export function xpForCorrectAnswer(q: Question, difficulty: Difficulty): XpAward {
  const base = XP_BASE[difficulty];
  const bonus = q.attempts.length === 1 && q.hintsShown === 0 ? UNAIDED_BONUS : 0;
  return { base, bonus, total: base + bonus };
}

export function levelFor(xp: number, complete: boolean): number {
  if (complete) return COMPLETION_LEVEL;
  let level = 0;
  for (const l of XP_LEVELS) if (xp >= l.xp) level = l.level;
  return level;
}

export function xpProgress(xp: number, complete: boolean, questionsLeft: number): XpProgress {
  const level = levelFor(xp, complete);
  const nextXp = XP_LEVELS.find((l) => l.level === level + 1);
  return {
    xp,
    level,
    maxLevel: COMPLETION_LEVEL,
    next:
      level >= COMPLETION_LEVEL
        ? null
        : nextXp
          ? { level: nextXp.level, xpNeeded: nextXp.xp - xp, questionsLeft: null }
          : { level: COMPLETION_LEVEL, xpNeeded: null, questionsLeft },
  };
}
