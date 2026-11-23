import type { NextRequest } from "next/server";
import { generateQuestion } from "@/lib/agent/quizmaster";
import { errorResponse } from "@/lib/http";
import { assertPhase, currentObjective, openQuestion, toPublicLesson } from "@/lib/lesson";
import { saveLesson, withLesson } from "@/lib/store";

export const maxDuration = 120;

/**
 * Returns the active question for the current objective, generating one if
 * needed. Idempotent: refreshing the page won't burn a new question.
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/lessons/[id]/question">) {
  try {
    const { id } = await ctx.params;
    const lesson = await withLesson(id, async (lesson) => {
      assertPhase(lesson, "learning");
      if (openQuestion(lesson)) return lesson;
      lesson.questions.push(await generateQuestion(lesson, currentObjective(lesson)!));
      return saveLesson(lesson);
    });
    return Response.json(toPublicLesson(lesson));
  } catch (err) {
    return errorResponse(err);
  }
}
