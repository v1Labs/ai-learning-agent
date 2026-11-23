import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { draftPlan } from "@/lib/agent/planner";
import { errorResponse } from "@/lib/http";
import { generateLessonContent } from "@/lib/jobs";
import { assertPhase, startLearning, toPublicLesson } from "@/lib/lesson";
import { saveLesson, withLesson } from "@/lib/store";

// Model calls, plus background generation via after() on approval (ADR 0019).
export const maxDuration = 300;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft") }),
  z.object({ action: z.literal("revise"), feedback: z.string().min(1).max(2000) }),
  z.object({
    action: z.literal("approve"),
    // Learner may reorder/remove objectives before approving (lightweight HITL edit).
    objectiveIds: z.array(z.string()).min(1).optional(),
  }),
]);

/**
 * Human-in-the-loop plan endpoint:
 *  - draft:   agent proposes a plan from the PDF (idempotent)
 *  - revise:  learner gives feedback, agent redrafts
 *  - approve: learner confirms (optionally pruning/reordering objectives); quiz generation starts
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/lessons/[id]/plan">) {
  try {
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());

    const lesson = await withLesson(id, async (lesson) => {
      switch (body.action) {
        case "draft": {
          if (lesson.plan) return lesson; // already drafted (e.g. page refresh)
          assertPhase(lesson, "planning");
          lesson.plan = await draftPlan({ lesson });
          lesson.phase = "awaiting_approval";
          break;
        }
        case "revise": {
          assertPhase(lesson, "awaiting_approval");
          lesson.plan = await draftPlan({
            lesson,
            previousPlan: lesson.plan,
            feedback: body.feedback,
          });
          lesson.planRevisions += 1;
          break;
        }
        case "approve": {
          assertPhase(lesson, "awaiting_approval");
          if (body.objectiveIds) {
            const byId = new Map(lesson.plan!.objectives.map((o) => [o.id, o]));
            const chosen = body.objectiveIds.map((oid) => byId.get(oid)).filter((o) => !!o);
            if (chosen.length === 0) throw new Error("No valid objectives selected");
            lesson.plan!.objectives = chosen;
          }
          startLearning(lesson);
          // Generate the whole quiz and the cards in the background (ADR 0009).
          after(() => generateLessonContent(lesson.id));
          break;
        }
      }
      return saveLesson(lesson);
    });

    return Response.json(toPublicLesson(lesson));
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.message }, { status: 400 });
    return errorResponse(err);
  }
}
