import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { gradeAnswer, toPublicLesson } from "@/lib/lesson";
import { saveLesson, withLesson } from "@/lib/store";
import type { AnswerResult } from "@/lib/types";

const Body = z.object({ questionId: z.string(), choiceIndex: z.number().int() });

/** Deterministic grading; no model call, so it's instant and the key stays server-side. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/lessons/[id]/answer">) {
  try {
    const { id } = await ctx.params;
    const { questionId, choiceIndex } = Body.parse(await req.json());
    const result = await withLesson(id, async (lesson): Promise<AnswerResult> => {
      const graded = gradeAnswer(lesson, questionId, choiceIndex);
      await saveLesson(lesson);
      return { ...graded, lesson: toPublicLesson(lesson) };
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.message }, { status: 400 });
    return errorResponse(err);
  }
}
