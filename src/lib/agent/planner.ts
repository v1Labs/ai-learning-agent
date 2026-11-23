import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { nanoid } from "nanoid";
import { anthropic, assertNotRefused, baseParams, COURSE_DESIGNER_SYSTEM, pdfDocumentBlock } from "../claude";
import type { LessonPlan } from "../types";

const PlanSchema = z.object({
  title: z.string().describe("Short lesson title"),
  overview: z.string().describe("2-3 sentence overview of what the learner will get out of the lesson"),
  objectives: z
    .array(
      z.object({
        title: z.string().describe("Learning objective phrased as an outcome, e.g. 'Explain how X drives Y'"),
        description: z.string().describe("One or two sentences on what mastering this objective means"),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]),
        keyConcepts: z.array(z.string()).describe("3-6 concepts from the document this objective covers"),
      }),
    )
    .describe("3-6 objectives, ordered from foundational to advanced"),
});

/**
 * Drafts (or revises) a learning path from the PDF. Revisions get the previous
 * plan plus the learner's feedback, which is the HITL loop.
 */
export async function draftPlan(args: {
  lessonId: string;
  fileName: string;
  previousPlan?: LessonPlan | null;
  feedback?: string;
}): Promise<LessonPlan> {
  const { lessonId, fileName, previousPlan, feedback } = args;

  const instructions = previousPlan
    ? `The learner reviewed this draft lesson plan and asked for changes.

<current_plan>
${JSON.stringify(stripIds(previousPlan), null, 2)}
</current_plan>

<learner_feedback>
${feedback ?? "(no specific feedback)"}
</learner_feedback>

Produce a revised plan that addresses the feedback while staying grounded in the document.`
    : `Analyze the document and propose a learning path: a short title, an overview, and 3-6 learning objectives ordered from foundational to advanced. Each objective should be assessable with multiple-choice questions and tagged with a difficulty that reflects the document's depth on that topic. Skip front matter, references, and other content that isn't worth learning.`;

  const response = await anthropic.beta.messages.parse({
    ...baseParams,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
    system: COURSE_DESIGNER_SYSTEM,
    messages: [
      {
        role: "user",
        content: [await pdfDocumentBlock(lessonId, fileName), { type: "text", text: instructions }],
      },
    ],
  });
  assertNotRefused(response);
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Failed to parse lesson plan");

  return {
    ...parsed,
    objectives: parsed.objectives.map((o) => ({ ...o, id: nanoid(8) })),
  };
}

function stripIds(plan: LessonPlan) {
  return {
    ...plan,
    objectives: plan.objectives.map((o) => ({ title: o.title, description: o.description, difficulty: o.difficulty, keyConcepts: o.keyConcepts })),
  };
}
