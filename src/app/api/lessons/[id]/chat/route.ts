import type { NextRequest } from "next/server";
import { z } from "zod";
import { runTutorTurn } from "@/lib/agent/tutor";
import { errorResponse } from "@/lib/http";
import { getLesson, NotFoundError, saveLesson, withLesson } from "@/lib/store";

// Streams a tutor turn (model call plus tool loop); allow time on Vercel (ADR 0019).
export const maxDuration = 300;

const Body = z.object({ message: z.string().min(1).max(4000) });

/**
 * Tutor chat. Streams plain text. The lesson is NOT locked during the stream
 * (so the learner can keep answering); the exchange is appended afterwards.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/lessons/[id]/chat">) {
  try {
    const { id } = await ctx.params;
    const { message } = Body.parse(await req.json());
    const lesson = await getLesson(id);
    if (!lesson) throw new NotFoundError("Lesson not found");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const reply = await runTutorTurn(lesson, message, (d) => controller.enqueue(encoder.encode(d)));
          await withLesson(id, async (l) => {
            const at = new Date().toISOString();
            l.chat.push({ role: "user", content: message, at }, { role: "assistant", content: reply, at });
            await saveLesson(l);
          });
        } catch (err) {
          console.error(err);
          controller.enqueue(encoder.encode("\n\n[Sorry, the tutor hit an error. Please try again.]"));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.message }, { status: 400 });
    return errorResponse(err);
  }
}
