// Shared setup for model evals: builds a real lesson from EVAL_PDF in a
// temporary data directory, using the same code paths as the app.
import type { Lesson } from "@/lib/types";
import { existsSync, mkdtempSync, readFileSync } from "fs";
import os from "os";
import path from "path";

export function requireEvalEnv(): string {
  const pdf = process.env.EVAL_PDF;
  if (!pdf || !existsSync(pdf)) throw new Error("Set EVAL_PDF to a PDF of 100 pages or fewer, e.g. EVAL_PDF=./chapter.pdf npm run eval");
  // Isolate eval lessons from the dev server's data.
  process.env.DATA_DIR ??= mkdtempSync(path.join(os.tmpdir(), "lesson-evals-"));
  return pdf;
}

/** Creates a lesson, drafts and approves its plan, and generates the full quiz. */
export async function buildLesson(pdfPath: string) {
  const { saveLesson, savePdf } = await import("@/lib/store");
  const { draftPlan } = await import("@/lib/agent/planner");
  const { generateQuestions } = await import("@/lib/agent/quizmaster");
  const { startLearning } = await import("@/lib/lesson");

  const id = `eval-${Date.now()}`;
  const now = new Date().toISOString();
  await savePdf(id, readFileSync(pdfPath));
  const lesson: Lesson = {
    id,
    fileName: path.basename(pdfPath),
    pdfUrl: null,
    phase: "awaiting_approval",
    plan: null,
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
  lesson.plan = await draftPlan({ lesson });
  startLearning(lesson);
  const sets = await Promise.all(
    lesson.allocation.map(({ objectiveId, count }) =>
      generateQuestions(lesson, lesson.plan!.objectives.find((o) => o.id === objectiveId)!, count),
    ),
  );
  lesson.questions = sets.flat();
  await saveLesson(lesson);
  return lesson;
}

export function report(title: string, rows: Record<string, unknown>[]) {
  console.log(`\n=== ${title} ===`);
  console.table(rows);
}
