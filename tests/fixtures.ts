import { startLearning } from "@/lib/lesson";
import type { Difficulty, Lesson, Question } from "@/lib/types";

/** A lesson in the given phase, with one objective per difficulty in `difficulties`. */
export function makeLesson(difficulties: Difficulty[] = ["beginner", "intermediate", "intermediate", "advanced"]): Lesson {
  const now = new Date().toISOString();
  return {
    id: "test-lesson",
    fileName: "test.pdf",
    pdfUrl: null,
    phase: "awaiting_approval",
    plan: {
      title: "Test lesson",
      overview: "Overview",
      objectives: difficulties.map((difficulty, i) => ({
        id: `obj${i + 1}`,
        title: `Objective ${i + 1}`,
        description: "Description",
        difficulty,
        keyConcepts: ["concept"],
      })),
    },
    planRevisions: 0,
    allocation: [],
    generation: {},
    questions: [],
    cards: [],
    chat: [],
    report: null,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Approves the plan and fills in every objective's questions (correct answer is always choice 0). */
export function makeLearningLesson(difficulties?: Difficulty[]): Lesson {
  const lesson = makeLesson(difficulties);
  startLearning(lesson);
  for (const a of lesson.allocation) {
    for (let order = 0; order < a.count; order++) lesson.questions.push(makeQuestion(a.objectiveId, order));
    lesson.generation[a.objectiveId] = { status: "ready" };
  }
  for (const c of lesson.cards) Object.assign(c, { status: "ready", title: "T", fact: "F", connection: "C" });
  return lesson;
}

export function makeQuestion(objectiveId: string, order: number): Question {
  return {
    id: `${objectiveId}-q${order}`,
    objectiveId,
    order,
    stem: `Question ${order} for ${objectiveId}`,
    choices: ["right", "wrong 1", "wrong 2", "wrong 3"],
    correctIndex: 0,
    explanation: "Because.",
    hints: ["Hint 1", "Hint 2"],
    attempts: [],
    answeredCorrectly: false,
    answeredAt: null,
    hintsShown: 0,
    xpAwarded: null,
    createdAt: new Date().toISOString(),
  };
}
