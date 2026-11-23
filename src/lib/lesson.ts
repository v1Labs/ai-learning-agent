import "server-only";
import { nanoid } from "nanoid";
import { levelFor, xpForCorrectAnswer, xpProgress } from "./gamification";
import type {
  AnswerResult,
  CardKind,
  DiscoveryCard,
  Lesson,
  LessonEvent,
  ObjectiveStats,
  PublicCard,
  PublicLesson,
  PublicQuestion,
  Question,
  QuestionAllocation,
} from "./types";

/** Fixed lesson length (ADR 0007): the completion target is 10 questions. */
export const LESSON_QUESTIONS = Number(process.env.LESSON_QUESTIONS ?? 10);

/** The question number each level's card is about, used to pick its objective (ADR 0010). */
const CARD_SCHEDULE: { level: number; atQuestion: number | "last"; kind: CardKind }[] = [
  { level: 1, atQuestion: 2, kind: "origin" },
  { level: 2, atQuestion: 5, kind: "real_world" },
  { level: 3, atQuestion: "last", kind: "big_picture" },
];

export class PhaseError extends Error {}

export function assertPhase(lesson: Lesson, ...phases: Lesson["phase"][]) {
  if (!phases.includes(lesson.phase)) {
    throw new PhaseError(`Lesson is in phase "${lesson.phase}", expected ${phases.join(" | ")}`);
  }
}

export function logEvent(lesson: Lesson, type: LessonEvent["type"], data?: LessonEvent["data"]) {
  lesson.events.push({ type, at: new Date().toISOString(), ...(data ? { data } : {}) });
}

// ---------- Approval: allocate questions and schedule cards ----------

/** Spreads `total` questions evenly across objectives; earlier objectives take the remainder. */
export function allocateQuestions(objectiveIds: string[], total = LESSON_QUESTIONS): QuestionAllocation[] {
  const ids = objectiveIds.slice(0, total);
  return ids.map((objectiveId, i) => ({
    objectiveId,
    count: Math.floor(total / ids.length) + (i < total % ids.length ? 1 : 0),
  }));
}

/** Objective that the Nth question (1-based) of the lesson belongs to. */
function objectiveAtQuestion(allocation: QuestionAllocation[], n: number): string {
  let seen = 0;
  for (const a of allocation) {
    seen += a.count;
    if (n <= seen) return a.objectiveId;
  }
  return allocation[allocation.length - 1].objectiveId;
}

/** Called when the learner approves the plan: fixes the quiz shape and queues background generation. */
export function startLearning(lesson: Lesson) {
  lesson.phase = "learning";
  lesson.allocation = allocateQuestions(lesson.plan!.objectives.map((o) => o.id));
  lesson.generation = Object.fromEntries(lesson.allocation.map((a) => [a.objectiveId, { status: "pending" as const }]));
  lesson.questions = [];
  lesson.cards = CARD_SCHEDULE.map(({ level, atQuestion, kind }) => ({
    id: nanoid(8),
    level,
    kind,
    objectiveId: objectiveAtQuestion(lesson.allocation, atQuestion === "last" ? LESSON_QUESTIONS : atQuestion),
    status: "pending",
    title: null,
    fact: null,
    connection: null,
    source: null,
    fromWeb: false,
    awardedAt: null,
  }));
  logEvent(lesson, "lesson_started", { objectives: lesson.allocation.length, questions: LESSON_QUESTIONS });
}

// ---------- Quiz navigation ----------

/** Questions in lesson order: objectives as approved, then by order within each. */
export function orderedQuestions(lesson: Lesson): Question[] {
  return lesson.allocation.flatMap((a) =>
    lesson.questions.filter((q) => q.objectiveId === a.objectiveId).sort((x, y) => x.order - y.order),
  );
}

/**
 * The learner's position: the first question not yet answered correctly, or
 * (if that objective hasn't finished generating) the objective we're waiting on.
 */
export function cursor(lesson: Lesson): { question: Question | null; waitingOn: string | null } {
  for (const a of lesson.allocation) {
    const qs = lesson.questions.filter((q) => q.objectiveId === a.objectiveId).sort((x, y) => x.order - y.order);
    const open = qs.find((q) => !q.answeredCorrectly);
    if (open) return { question: open, waitingOn: null };
    if (qs.length < a.count) return { question: null, waitingOn: a.objectiveId };
  }
  return { question: null, waitingOn: null };
}

export function openQuestion(lesson: Lesson): Question | null {
  return lesson.phase === "learning" ? cursor(lesson).question : null;
}

export function currentObjective(lesson: Lesson) {
  const { question, waitingOn } = cursor(lesson);
  const id = question?.objectiveId ?? waitingOn;
  return lesson.plan?.objectives.find((o) => o.id === id) ?? null;
}

function difficultyOf(lesson: Lesson, objectiveId: string) {
  return lesson.plan?.objectives.find((o) => o.id === objectiveId)?.difficulty ?? "beginner";
}

export function totalXp(lesson: Lesson) {
  return lesson.questions.reduce((n, q) => n + (q.xpAwarded?.total ?? 0), 0);
}

function answeredCount(lesson: Lesson) {
  return lesson.questions.filter((q) => q.answeredCorrectly).length;
}

// ---------- Grading ----------

/**
 * Grades an answer deterministically: no LLM in the loop, and the key never
 * leaves the server. Correct answers earn XP and may level up (awarding a
 * card); wrong ones reveal the next hint and allow a retry.
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
  const number = orderedQuestions(lesson).indexOf(q) + 1;
  logEvent(lesson, "question_answered", { number, correct, attempt: q.attempts.length });

  if (!correct) {
    const hint = revealNextHint(q);
    return {
      correct,
      question: toPublicQuestion(lesson, q),
      feedback: hint ?? "Take another look: rule out the options you know are wrong and try again.",
      levelUp: null,
    };
  }

  const levelBefore = levelFor(totalXp(lesson), false);
  q.answeredCorrectly = true;
  q.answeredAt = new Date().toISOString();
  q.xpAwarded = xpForCorrectAnswer(q, difficultyOf(lesson, q.objectiveId));

  const complete = answeredCount(lesson) >= LESSON_QUESTIONS;
  if (complete) {
    lesson.phase = "complete";
    logEvent(lesson, "lesson_completed", { xp: totalXp(lesson) });
  }
  const levelAfter = levelFor(totalXp(lesson), complete);

  let levelUp: AnswerResult["levelUp"] = null;
  for (let level = levelBefore + 1; level <= levelAfter; level++) {
    const card = lesson.cards.find((c) => c.level === level);
    if (card) card.awardedAt = new Date().toISOString();
    logEvent(lesson, "level_up", { level, number });
    if (card) logEvent(lesson, "card_awarded", { level, ready: card.status === "ready", fromWeb: card.fromWeb });
    levelUp = { level, cardId: card?.id ?? null };
  }

  return { correct, question: toPublicQuestion(lesson, q), feedback: q.explanation, levelUp };
}

/** Reveals the next unseen hint, or null when all are already shown. */
export function revealNextHint(q: Question): string | null {
  if (q.hintsShown >= q.hints.length) return null;
  return q.hints[q.hintsShown++];
}

// ---------- Projections ----------

export function computeStats(lesson: Lesson): ObjectiveStats[] {
  return lesson.allocation.map((a) => {
    const qs = lesson.questions.filter((q) => q.objectiveId === a.objectiveId && q.answeredCorrectly);
    return {
      objectiveId: a.objectiveId,
      title: lesson.plan?.objectives.find((o) => o.id === a.objectiveId)?.title ?? "",
      questions: qs.length,
      firstTryCorrect: qs.filter((q) => q.attempts.length === 1).length,
      totalAttempts: qs.reduce((n, q) => n + q.attempts.length, 0),
      hintsUsed: qs.reduce((n, q) => n + q.hintsShown, 0),
    };
  });
}

export function toPublicQuestion(lesson: Lesson, q: Question): PublicQuestion {
  return {
    id: q.id,
    objectiveId: q.objectiveId,
    number: orderedQuestions(lesson).indexOf(q) + 1,
    stem: q.stem,
    choices: q.choices,
    wrongAttempts: q.attempts.filter((a) => a !== q.correctIndex),
    answeredCorrectly: q.answeredCorrectly,
    correctIndex: q.answeredCorrectly ? q.correctIndex : null,
    explanation: q.answeredCorrectly ? q.explanation : null,
    hintsShown: q.hints.slice(0, q.hintsShown),
    xpAwarded: q.xpAwarded,
  };
}

/** Cards stay locked (no content at all) until awarded, so they can't hint at answers. */
function toPublicCard(c: DiscoveryCard): PublicCard {
  if (!c.awardedAt) return { state: "locked", id: c.id, level: c.level, kind: c.kind };
  if (c.status !== "ready") return { state: "researching", id: c.id, level: c.level, kind: c.kind };
  return {
    state: "revealed",
    id: c.id,
    level: c.level,
    kind: c.kind,
    title: c.title,
    fact: c.fact,
    connection: c.connection,
    source: c.source,
    fromWeb: c.fromWeb,
  };
}

export function toPublicLesson(lesson: Lesson): PublicLesson {
  const { question, waitingOn } = lesson.phase === "learning" ? cursor(lesson) : { question: null, waitingOn: null };
  const answered = answeredCount(lesson);
  const total = lesson.allocation.reduce((n, a) => n + a.count, 0) || LESSON_QUESTIONS;
  return {
    id: lesson.id,
    fileName: lesson.fileName,
    phase: lesson.phase,
    plan: lesson.plan,
    totalQuestions: total,
    answeredQuestions: answered,
    activeQuestion: question ? toPublicQuestion(lesson, question) : null,
    waitingOn: waitingOn ? { objectiveId: waitingOn, status: lesson.generation[waitingOn]?.status ?? "pending" } : null,
    chat: lesson.chat,
    stats: computeStats(lesson),
    progress: xpProgress(totalXp(lesson), lesson.phase === "complete", total - answered),
    cards: lesson.cards.map(toPublicCard),
    report: lesson.report,
  };
}
