import { after, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { generateLessonContent } from "@/lib/jobs";
import { assertPhase, toPublicLesson } from "@/lib/lesson";
import { getLesson, NotFoundError } from "@/lib/store";

/**
 * Ensures background generation is running for anything not finished yet:
 * resumes after a server restart and retries failed objectives or cards.
 * Idempotent: work already in flight is skipped. Returns the lesson immediately.
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/lessons/[id]/generate">) {
  try {
    const { id } = await ctx.params;
    const lesson = await getLesson(id);
    if (!lesson) throw new NotFoundError("Lesson not found");
    assertPhase(lesson, "learning", "complete");
    after(() => generateLessonContent(id));
    return Response.json(toPublicLesson(lesson));
  } catch (err) {
    return errorResponse(err);
  }
}
