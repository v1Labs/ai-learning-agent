import "server-only";
import { writeCard } from "./agent/cardwriter";
import { generateQuestions } from "./agent/quizmaster";
import { getLesson, runOnce, saveLesson, withLesson } from "./store";

// Background generation (ADR 0009). After approval, every objective's
// questions are generated in parallel, then each objective's discovery card.
// Model calls run outside the lesson lock; results are merged in under it.
// Idempotent: re-running skips finished work, and a lease (Redis when
// deployed) skips work already in flight on any instance (ADR 0019).

// Longer than the slowest job (card research has a 90s timeout plus fallback).
const JOB_LEASE_MS = 4 * 60_000;
const once = (key: string, fn: () => Promise<void>) => runOnce(key, JOB_LEASE_MS, fn);

export async function generateLessonContent(lessonId: string) {
  const lesson = await getLesson(lessonId);
  if (!lesson || lesson.phase === "planning" || lesson.phase === "awaiting_approval") return;

  const pending = lesson.allocation.filter(({ objectiveId }) => lesson.generation[objectiveId]?.status !== "ready");
  const generate = ({ objectiveId, count }: { objectiveId: string; count: number }) =>
    once(`${lessonId}:q:${objectiveId}`, () => generateObjective(lessonId, objectiveId, count));

  // Parallel requests can't read a cache entry that another is still writing,
  // so a cold fan-out pays the full PDF write once per objective (ADR 0022).
  // The first objective runs alone to warm the cache. The learner waits for
  // its questions anyway, so time to first question doesn't change.
  const [first, ...rest] = pending;
  const firstDone = first ? generate(first) : Promise.resolve();

  await Promise.all(
    lesson.allocation.map(async (alloc) => {
      if (alloc === first) await firstDone;
      else if (rest.includes(alloc)) await firstDone.then(() => generate(alloc));
      // Cards need the objective's questions (to avoid leaking answers), so they follow.
      const cards = (await getLesson(lessonId))?.cards.filter((c) => c.objectiveId === alloc.objectiveId && c.status !== "ready");
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
