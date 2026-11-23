// Domain model for a lesson. The server is the source of truth for the
// pedagogical flow; the client only ever sees the `Public*` projections.

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type LessonPhase =
  | "planning" // PDF uploaded, plan not drafted yet
  | "awaiting_approval" // HITL: plan drafted, waiting for the learner
  | "learning" // quiz loop
  | "complete"; // all questions answered, report available

export interface Objective {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  keyConcepts: string[];
}

export interface LessonPlan {
  title: string;
  overview: string;
  objectives: Objective[];
}

/** How many questions each approved objective gets (fixed lesson length, ADR 0007). */
export interface QuestionAllocation {
  objectiveId: string;
  count: number;
}

export type JobStatus = "pending" | "ready" | "failed";

/** Full question, including the answer key. Never sent to the browser or the tutor model. */
export interface Question {
  id: string;
  objectiveId: string;
  /** Position within its objective. */
  order: number;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  /** Escalating hints: nudge -> stronger nudge. None may reveal the answer. */
  hints: string[];
  attempts: number[]; // choice indices, in order
  answeredCorrectly: boolean;
  answeredAt: string | null;
  hintsShown: number;
  xpAwarded: XpAward | null;
  createdAt: string;
}

export interface XpAward {
  base: number;
  bonus: number;
  total: number;
}

export type CardKind = "origin" | "real_world" | "big_picture";

/** Level-up reward (ADR 0008). Pre-generated in the background, revealed on level-up. */
export interface DiscoveryCard {
  id: string;
  level: number;
  kind: CardKind;
  objectiveId: string;
  status: JobStatus;
  title: string | null;
  fact: string | null;
  connection: string | null;
  source: { url: string; title: string; domain: string } | null;
  /** False when web research failed and the card was written from the PDF alone. */
  fromWeb: boolean;
  awardedAt: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface ProgressReport {
  headline: string;
  strengths: string[];
  areasToReview: string[];
  studyTips: string[];
}

/** Funnel instrumentation (ADR 0007). */
export interface LessonEvent {
  type: "lesson_started" | "question_answered" | "level_up" | "card_awarded" | "lesson_completed";
  at: string;
  data?: Record<string, string | number | boolean>;
}

export interface Lesson {
  id: string;
  fileName: string;
  phase: LessonPhase;
  plan: LessonPlan | null;
  /** Number of times the learner asked for the plan to be revised. */
  planRevisions: number;
  allocation: QuestionAllocation[];
  /** Question generation status per objective. */
  generation: Record<string, { status: JobStatus; error?: string }>;
  questions: Question[];
  cards: DiscoveryCard[];
  chat: ChatMessage[];
  report: ProgressReport | null;
  events: LessonEvent[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Public projections (safe to send to the client) ----------

export interface PublicQuestion {
  id: string;
  objectiveId: string;
  /** 1-based position in the whole lesson. */
  number: number;
  stem: string;
  choices: string[];
  /** Wrong choices the learner already tried (so the widget can keep them red). */
  wrongAttempts: number[];
  answeredCorrectly: boolean;
  /** Only populated once answered correctly. */
  correctIndex: number | null;
  explanation: string | null;
  hintsShown: string[];
  xpAwarded: XpAward | null;
}

export interface ObjectiveStats {
  objectiveId: string;
  title: string;
  questions: number;
  firstTryCorrect: number;
  totalAttempts: number;
  hintsUsed: number;
}

export type PublicCard =
  | { state: "locked"; id: string; level: number; kind: CardKind }
  | { state: "researching"; id: string; level: number; kind: CardKind }
  | ({ state: "revealed" } & Omit<DiscoveryCard, "status" | "awardedAt" | "objectiveId">);

export interface XpProgress {
  xp: number;
  level: number;
  maxLevel: number;
  /** What it takes to reach the next level, or null at max level. */
  next: { level: number; xpNeeded: number | null; questionsLeft: number | null } | null;
}

export interface PublicLesson {
  id: string;
  fileName: string;
  phase: LessonPhase;
  plan: LessonPlan | null;
  totalQuestions: number;
  answeredQuestions: number;
  /** First unanswered question, or null if it's still being generated / lesson complete. */
  activeQuestion: PublicQuestion | null;
  /** Objective whose questions are still being generated, when the learner is waiting on it. */
  waitingOn: { objectiveId: string; status: JobStatus } | null;
  chat: ChatMessage[];
  stats: ObjectiveStats[];
  progress: XpProgress;
  cards: PublicCard[];
  report: ProgressReport | null;
}

export interface AnswerResult {
  correct: boolean;
  question: PublicQuestion;
  /** Hint (incorrect) or explanation (correct). */
  feedback: string;
  /** Present when this answer crossed a level threshold. */
  levelUp: { level: number; cardId: string | null } | null;
  lesson: PublicLesson;
}
