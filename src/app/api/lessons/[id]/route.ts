import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { toPublicLesson } from "@/lib/lesson";
import { getLesson, NotFoundError } from "@/lib/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/lessons/[id]">) {
  try {
    const { id } = await ctx.params;
    const lesson = await getLesson(id);
    if (!lesson) throw new NotFoundError("Lesson not found");
    return Response.json(toPublicLesson(lesson));
  } catch (err) {
    return errorResponse(err);
  }
}
