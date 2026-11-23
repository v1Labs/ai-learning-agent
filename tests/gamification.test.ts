import { describe, expect, it } from "vitest";
import { COMPLETION_LEVEL, levelFor, xpForCorrectAnswer, xpProgress } from "@/lib/gamification";
import { makeQuestion } from "./fixtures";

const answered = (attempts: number[], hintsShown = 0) => ({ ...makeQuestion("o", 0), attempts, hintsShown });

describe("xpForCorrectAnswer (ADR 0007)", () => {
  it.each([
    ["beginner", 10],
    ["intermediate", 15],
    ["advanced", 20],
  ] as const)("pays %s base XP plus the unaided bonus on a clean first try", (difficulty, base) => {
    expect(xpForCorrectAnswer(answered([0]), difficulty)).toEqual({ base, bonus: 5, total: base + 5 });
  });

  it("still pays base XP after a retry, without the bonus", () => {
    expect(xpForCorrectAnswer(answered([2, 0]), "intermediate")).toEqual({ base: 15, bonus: 0, total: 15 });
  });

  it("treats any hint (quiz or tutor) as aided, even on the first try", () => {
    expect(xpForCorrectAnswer(answered([0], 1), "beginner").bonus).toBe(0);
  });
});

describe("levels", () => {
  it("unlocks level 1 at 25 XP and level 2 at 70 XP", () => {
    expect(levelFor(24, false)).toBe(0);
    expect(levelFor(25, false)).toBe(1);
    expect(levelFor(69, false)).toBe(1);
    expect(levelFor(70, false)).toBe(2);
    expect(levelFor(500, false)).toBe(2); // XP alone never reaches the final level
  });

  it("reaches the final level only by completing the lesson", () => {
    expect(levelFor(0, true)).toBe(COMPLETION_LEVEL);
  });

  it("describes what it takes to reach the next level", () => {
    expect(xpProgress(10, false, 9).next).toEqual({ level: 1, xpNeeded: 15, questionsLeft: null });
    expect(xpProgress(80, false, 4).next).toEqual({ level: 3, xpNeeded: null, questionsLeft: 4 });
    expect(xpProgress(150, true, 0).next).toBeNull();
  });
});
