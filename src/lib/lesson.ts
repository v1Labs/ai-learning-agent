import "server-only";
import type { AnswerResult, Lesson, ObjectiveStats, PublicLesson, PublicQuestion, Question } from "./types";

export const QUESTIONS_PER_OBJECTIVE = Number(process.env.QUESTIONS_PER_OBJECTIVE ?? 2);

export class PhaseError extends Error {}

export function assertPhase(lesson: Lesson, ...phases: Lesson["phase"][]) {
  if (!phases.includes(lesson.phase)) {
    throw new PhaseError(`Lesson is in phase "${lesson.phase}", expected ${phases.join(" | ")}`);
  }
}

export function currentObjective(lesson: Lesson) {
  return lesson.plan?.objectives[lesson.currentObjectiveIndex] ?? null;
}

/** The latest question for the current objective that hasn't been answered correctly yet. */
export function openQuestion(lesson: Lesson): Question | null {
  const obj = currentObjective(lesson);
  if (!obj) return null;
  const last = [...lesson.questions].reverse().find((q) => q.objectiveId === obj.id);
  return last && !last.answeredCorrectly ? last : null;
}

function answeredIn(lesson: Lesson, objectiveId: string) {
  return lesson.questions.filter((q) => q.objectiveId === objectiveId && q.answeredCorrectly).length;
}

/**
 * Grades an answer deterministically: no LLM in the loop, and the key never
 * leaves the server. Correct answers advance the lesson; wrong ones reveal
 * the next hint and allow a retry.
 */
export function gradeAnswer(lesson: Lesson, questionId: string, choiceIndex: number): Omit<AnswerResult, "lesson"> {
  assertPhase(lesson, "learning");
  const q = openQuestion(lesson);
  if (!q || q.id !== questionId) throw new PhaseError("That question is no longer active");
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= q.choices.length) {
    throw new PhaseError("Invalid choice");
  }
  if (q.attempts.includes(choiceIndex)) throw new PhaseError("You already tried that choice");

  q.attempts.push(choiceIndex);
  const correct = choiceIndex === q.correctIndex;

  if (correct) {
    q.answeredCorrectly = true;
    const obj = currentObjective(lesson)!;
    if (answeredIn(lesson, obj.id) >= QUESTIONS_PER_OBJECTIVE) {
      lesson.currentObjectiveIndex += 1;
      if (lesson.currentObjectiveIndex >= lesson.plan!.objectives.length) lesson.phase = "complete";
    }
    return { correct, question: toPublicQuestion(q), feedback: q.explanation };
  }

  const hint = revealNextHint(q);
  return {
    correct,
    question: toPublicQuestion(q),
    feedback: hint ?? "Take another look: rule out the options you know are wrong and try again.",
  };
}

/** Reveals the next unseen hint, or null when all are already shown. */
export function revealNextHint(q: Question): string | null {
  if (q.hintsShown >= q.hints.length) return null;
  return q.hints[q.hintsShown++];
}

export function computeStats(lesson: Lesson): ObjectiveStats[] {
  return (lesson.plan?.objectives ?? []).map((o) => {
    const qs = lesson.questions.filter((q) => q.objectiveId === o.id && q.answeredCorrectly);
    return {
      objectiveId: o.id,
      title: o.title,
      questions: qs.length,
      firstTryCorrect: qs.filter((q) => q.attempts.length === 1).length,
      totalAttempts: qs.reduce((n, q) => n + q.attempts.length, 0),
      hintsUsed: qs.reduce((n, q) => n + q.hintsShown, 0),
    };
  });
}

export function toPublicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    objectiveId: q.objectiveId,
    stem: q.stem,
    choices: q.choices,
    wrongAttempts: q.attempts.filter((a) => a !== q.correctIndex),
    answeredCorrectly: q.answeredCorrectly,
    correctIndex: q.answeredCorrectly ? q.correctIndex : null,
    explanation: q.answeredCorrectly ? q.explanation : null,
    hintsShown: q.hints.slice(0, q.hintsShown),
  };
}

export function toPublicLesson(lesson: Lesson): PublicLesson {
  const obj = currentObjective(lesson);
  // Show the open question, or the just-answered one so the widget can display its explanation.
  const latest = lesson.questions.at(-1);
  return {
    id: lesson.id,
    fileName: lesson.fileName,
    phase: lesson.phase,
    plan: lesson.plan,
    currentObjectiveIndex: lesson.currentObjectiveIndex,
    questionsPerObjective: QUESTIONS_PER_OBJECTIVE,
    currentQuestion: latest ? toPublicQuestion(latest) : null,
    answeredInObjective: obj ? answeredIn(lesson, obj.id) : 0,
    chat: lesson.chat,
    stats: computeStats(lesson),
    report: lesson.report,
  };
}
