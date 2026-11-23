// Domain model for a lesson. The server is the source of truth for the
// pedagogical flow; the client only ever sees the `Public*` projections.

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type LessonPhase =
  | "planning" // PDF uploaded, plan not drafted yet
  | "awaiting_approval" // HITL: plan drafted, waiting for the learner
  | "learning" // quiz loop
  | "complete"; // all objectives exhausted, report available

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

/** Full question, including the answer key. Never sent to the browser or the tutor model. */
export interface Question {
  id: string;
  objectiveId: string;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  /** Escalating hints: nudge -> stronger nudge. None may reveal the answer. */
  hints: string[];
  attempts: number[]; // choice indices, in order
  answeredCorrectly: boolean;
  hintsShown: number;
  createdAt: string;
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

export interface Lesson {
  id: string;
  fileName: string;
  phase: LessonPhase;
  plan: LessonPlan | null;
  /** Number of times the learner asked for the plan to be revised. */
  planRevisions: number;
  currentObjectiveIndex: number;
  questions: Question[];
  chat: ChatMessage[];
  report: ProgressReport | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Public projections (safe to send to the client) ----------

export interface PublicQuestion {
  id: string;
  objectiveId: string;
  stem: string;
  choices: string[];
  /** Wrong choices the learner already tried (so the widget can keep them red). */
  wrongAttempts: number[];
  answeredCorrectly: boolean;
  /** Only populated once answered correctly. */
  correctIndex: number | null;
  explanation: string | null;
  hintsShown: string[];
}

export interface ObjectiveStats {
  objectiveId: string;
  title: string;
  questions: number;
  firstTryCorrect: number;
  totalAttempts: number;
  hintsUsed: number;
}

export interface PublicLesson {
  id: string;
  fileName: string;
  phase: LessonPhase;
  plan: LessonPlan | null;
  currentObjectiveIndex: number;
  questionsPerObjective: number;
  currentQuestion: PublicQuestion | null;
  answeredInObjective: number;
  chat: ChatMessage[];
  stats: ObjectiveStats[];
  report: ProgressReport | null;
}

export interface AnswerResult {
  correct: boolean;
  question: PublicQuestion;
  /** Hint (incorrect) or explanation (correct). */
  feedback: string;
  lesson: PublicLesson;
}
