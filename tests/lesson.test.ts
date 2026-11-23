import { describe, expect, it } from "vitest";
import {
  allocateQuestions,
  cursor,
  gradeAnswer,
  LESSON_QUESTIONS,
  orderedQuestions,
  PhaseError,
  startLearning,
  toPublicLesson,
} from "@/lib/lesson";
import type { Lesson } from "@/lib/types";
import { makeLearningLesson, makeLesson, makeQuestion } from "./fixtures";

/** Answers the active question: `wrongFirst` wrong attempts, then the right one. */
function answerNext(lesson: Lesson, wrongFirst = 0) {
  const q = cursor(lesson).question!;
  for (let i = 1; i <= wrongFirst; i++) gradeAnswer(lesson, q.id, i);
  return gradeAnswer(lesson, q.id, 0);
}

describe("allocateQuestions (ADR 0007: fixed 10-question lesson)", () => {
  it.each([
    [4, [3, 3, 2, 2]],
    [6, [2, 2, 2, 2, 1, 1]],
    [3, [4, 3, 3]],
    [1, [10]],
  ])("spreads 10 questions over %i objectives, earlier ones taking the remainder", (n, expected) => {
    const ids = Array.from({ length: n }, (_, i) => `o${i}`);
    expect(allocateQuestions(ids).map((a) => a.count)).toEqual(expected);
  });

  it("never schedules more objectives than questions", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `o${i}`);
    const alloc = allocateQuestions(ids);
    expect(alloc).toHaveLength(10);
    expect(alloc.every((a) => a.count === 1)).toBe(true);
  });
});

describe("startLearning", () => {
  it("schedules each card on the objective holding questions 2, 5 and the last (ADR 0010)", () => {
    const lesson = makeLesson(["beginner", "intermediate", "intermediate", "advanced"]); // 3, 3, 2, 2
    startLearning(lesson);
    expect(lesson.cards.map((c) => [c.level, c.objectiveId, c.kind])).toEqual([
      [1, "obj1", "origin"],
      [2, "obj2", "real_world"],
      [3, "obj4", "big_picture"],
    ]);
    expect(Object.values(lesson.generation).every((g) => g.status === "pending")).toBe(true);
    expect(lesson.events.map((e) => e.type)).toEqual(["lesson_started"]);
  });
});

describe("cursor", () => {
  it("waits on an objective whose questions aren't generated yet", () => {
    const lesson = makeLesson();
    startLearning(lesson);
    expect(cursor(lesson)).toEqual({ question: null, waitingOn: "obj1" });
  });

  it("serves objective 1 even while later objectives are still generating", () => {
    const lesson = makeLesson();
    startLearning(lesson);
    lesson.questions.push(makeQuestion("obj1", 1), makeQuestion("obj1", 0), makeQuestion("obj1", 2));
    expect(cursor(lesson).question?.id).toBe("obj1-q0"); // ordered by `order`, not insertion
  });
});

describe("gradeAnswer", () => {
  it("reveals escalating hints on wrong answers and allows retries", () => {
    const lesson = makeLearningLesson();
    const q = cursor(lesson).question!;
    expect(gradeAnswer(lesson, q.id, 1)).toMatchObject({ correct: false, feedback: "Hint 1" });
    expect(gradeAnswer(lesson, q.id, 2)).toMatchObject({ correct: false, feedback: "Hint 2" });
    expect(gradeAnswer(lesson, q.id, 3).feedback).toMatch(/rule out/); // hints exhausted
    expect(gradeAnswer(lesson, q.id, 0)).toMatchObject({ correct: true, feedback: "Because." });
  });

  it("rejects a repeated wrong choice, an inactive question and an out-of-range choice", () => {
    const lesson = makeLearningLesson();
    const q = cursor(lesson).question!;
    gradeAnswer(lesson, q.id, 1);
    expect(() => gradeAnswer(lesson, q.id, 1)).toThrow(PhaseError);
    expect(() => gradeAnswer(lesson, "not-active", 0)).toThrow(PhaseError);
    expect(() => gradeAnswer(lesson, q.id, 7)).toThrow(PhaseError);
  });

  it("plays a full lesson: levels at questions 2 and 5, completion at 10 (matches the ADR 0007 simulation)", () => {
    const lesson = makeLearningLesson(["beginner", "intermediate", "intermediate", "advanced"]);
    const levelUps: Record<number, number> = {};
    for (let n = 1; n <= LESSON_QUESTIONS; n++) {
      const result = answerNext(lesson);
      if (result.levelUp) levelUps[result.levelUp.level] = n;
    }
    expect(levelUps).toEqual({ 1: 2, 2: 5, 3: 10 });
    expect(lesson.phase).toBe("complete");
    expect(lesson.cards.every((c) => c.awardedAt)).toBe(true);
    expect(toPublicLesson(lesson).progress).toMatchObject({ level: 3, next: null });
  });

  it("logs funnel events for every attempt, level-up and completion", () => {
    const lesson = makeLearningLesson();
    answerNext(lesson, 1);
    answerNext(lesson);
    const types = lesson.events.map((e) => e.type);
    expect(types.filter((t) => t === "question_answered")).toHaveLength(3);
    expect(types).toContain("level_up");
    expect(types).toContain("card_awarded");
  });

  it("refuses answers once the lesson is complete", () => {
    const lesson = makeLearningLesson();
    for (let n = 1; n <= LESSON_QUESTIONS; n++) answerNext(lesson);
    const last = orderedQuestions(lesson).at(-1)!;
    expect(() => gradeAnswer(lesson, last.id, 0)).toThrow(PhaseError);
  });
});

describe("public projection (ADR 0004: answer keys never leave the server)", () => {
  it("hides the key, explanation and unrevealed hints until answered correctly", () => {
    const lesson = makeLearningLesson();
    const q = cursor(lesson).question!;
    gradeAnswer(lesson, q.id, 2);
    const pub = toPublicLesson(lesson).activeQuestion!;
    expect(pub.correctIndex).toBeNull();
    expect(pub.explanation).toBeNull();
    expect(pub.hintsShown).toEqual(["Hint 1"]);
    expect(pub.wrongAttempts).toEqual([2]);
    expect(JSON.stringify(toPublicLesson(lesson))).not.toContain("Because.");
  });

  it("never serialises unanswered questions' keys anywhere in the lesson payload", () => {
    const lesson = makeLearningLesson();
    const json = JSON.stringify(toPublicLesson(lesson));
    expect(json).not.toContain('"correctIndex":0');
    expect(json).not.toContain("Hint 2");
  });

  it("shows locked cards with no content at all (ADR 0008)", () => {
    const lesson = makeLearningLesson();
    const cards = toPublicLesson(lesson).cards;
    expect(cards.every((c) => c.state === "locked")).toBe(true);
    expect(cards[0]).toEqual({ state: "locked", id: cards[0].id, level: 1, kind: "origin" });
  });
});
