import "server-only";
import { writeCard } from "./agent/cardwriter";
import { generateQuestions } from "./agent/quizmaster";
import { getLesson, saveLesson, withLesson } from "./store";

// Background generation (ADR 0009). After approval, every objective's
// questions are generated in parallel, then each objective's discovery card.
// Model calls run outside the lesson lock; results are merged in under it.
// Idempotent: re-running skips finished work and anything already in flight,
// so it also resumes after a server restart.

const inflight = new Set<string>();

async function once(key: string, fn: () => Promise<void>) {
  if (inflight.has(key)) return;
  inflight.add(key);
  try {
    await fn();
  } finally {
    inflight.delete(key);
  }
}

export async function generateLessonContent(lessonId: string) {
  const lesson = await getLesson(lessonId);
  if (!lesson || lesson.phase === "planning" || lesson.phase === "awaiting_approval") return;

  await Promise.all(
    lesson.allocation.map(async ({ objectiveId, count }) => {
      if (lesson.generation[objectiveId]?.status !== "ready") {
        await once(`${lessonId}:q:${objectiveId}`, () => generateObjective(lessonId, objectiveId, count));
      }
      // Cards need the objective's questions (to avoid leaking answers), so they follow.
      const cards = (await getLesson(lessonId))?.cards.filter((c) => c.objectiveId === objectiveId && c.status !== "ready");
      await Promise.all((cards ?? []).map((c) => once(`${lessonId}:card:${c.id}`, () => generateCard(lessonId, c.id))));
    }),
  );
}

async function generateObjective(lessonId: string, objectiveId: string, count: number) {
  try {
    const lesson = (await getLesson(lessonId))!;
    const objective = lesson.plan!.objectives.find((o) => o.id === objectiveId)!;
    const questions = await generateQuestions(lesson, objective, count);
    await withLesson(lessonId, async (l) => {
      if (l.questions.some((q) => q.objectiveId === objectiveId)) return; // already written
      l.questions.push(...questions);
      l.generation[objectiveId] = { status: "ready" };
      await saveLesson(l);
    });
  } catch (err) {
    console.error(`Question generation failed (lesson ${lessonId}, objective ${objectiveId}):`, err);
    await withLesson(lessonId, async (l) => {
      l.generation[objectiveId] = { status: "failed", error: (err as Error).message };
      await saveLesson(l);
    });
  }
}

async function generateCard(lessonId: string, cardId: string) {
  try {
    const lesson = (await getLesson(lessonId))!;
    const card = lesson.cards.find((c) => c.id === cardId)!;
    if (!lesson.questions.some((q) => q.objectiveId === card.objectiveId)) return; // questions not ready yet
    const content = await writeCard(lesson, card);
    await withLesson(lessonId, async (l) => {
      const c = l.cards.find((x) => x.id === cardId)!;
      Object.assign(c, content, { status: "ready" });
      await saveLesson(l);
    });
  } catch (err) {
    console.error(`Card generation failed (lesson ${lessonId}, card ${cardId}):`, err);
    await withLesson(lessonId, async (l) => {
      const c = l.cards.find((x) => x.id === cardId)!;
      c.status = "failed";
      await saveLesson(l);
    });
  }
}
