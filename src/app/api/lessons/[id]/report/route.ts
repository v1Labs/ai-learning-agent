import type { NextRequest } from "next/server";
import { writeReport } from "@/lib/agent/reporter";
import { errorResponse } from "@/lib/http";
import { assertPhase, computeStats, toPublicLesson } from "@/lib/lesson";
import { saveLesson, withLesson } from "@/lib/store";

export const maxDuration = 120;

/** Generates (once) and returns the end-of-lesson progress report. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/lessons/[id]/report">) {
  try {
    const { id } = await ctx.params;
    const lesson = await withLesson(id, async (lesson) => {
      assertPhase(lesson, "complete");
      if (lesson.report) return lesson;
      lesson.report = await writeReport(lesson, computeStats(lesson));
      return saveLesson(lesson);
    });
    return Response.json(toPublicLesson(lesson));
  } catch (err) {
    return errorResponse(err);
  }
}
