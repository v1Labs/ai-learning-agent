import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { nanoid } from "nanoid";
import { anthropic, assertNotRefused, baseParams, COURSE_DESIGNER_EFFORT, COURSE_DESIGNER_SYSTEM, logUsage, pdfDocumentBlock } from "../claude";
import type { Lesson, Objective, Question } from "../types";

const QuestionSchema = z.object({
  stem: z.string().describe("The question. Self-contained; do not reference 'the document' or page numbers."),
  choices: z.array(z.string()).describe("Exactly 4 answer choices, plausible distractors, no 'all of the above'"),
  correctIndex: z.number().int().describe("0-based index of the single correct choice"),
  explanation: z.string().describe("Why the correct answer is right and the main distractor is wrong, 2-4 sentences"),
  hints: z
    .array(z.string())
    .describe(
      "Exactly 2 escalating hints. Hint 1 points at the relevant concept; hint 2 narrows further. Neither may state or directly imply which choice is correct.",
    ),
});

const QuestionSetSchema = z.object({ questions: z.array(QuestionSchema) });

type Draft = z.infer<typeof QuestionSchema>;

// Strict decoding can't express "exactly 4" or an in-range index, so check in code.
const isValid = (q: Draft) => q.choices.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4 && q.hints.length >= 1;

/**
 * Generates all `count` questions for one objective in a single call, so they
 * cover different concepts and build in difficulty. Regenerates the shortfall
 * once if some drafts are malformed.
 */
export async function generateQuestions(lesson: Lesson, objective: Objective, count: number): Promise<Question[]> {
  const valid: Draft[] = [];

  for (let attempt = 0; attempt < 2 && valid.length < count; attempt++) {
    const needed = count - valid.length;
    const avoid = valid.map((q) => `- ${q.stem}`).join("\n");
    const instructions = `Write ${needed} multiple-choice question${needed === 1 ? "" : "s"} assessing this learning objective.

<objective difficulty="${objective.difficulty}">
${objective.title}
${objective.description}
Key concepts: ${objective.keyConcepts.join(", ")}
</objective>

Each question must assess a different concept or angle of the objective${avoid ? `, and differ from these existing questions:\n${avoid}` : "."}
Match the ${objective.difficulty} difficulty: beginner = recall and recognition, intermediate = application, advanced = analysis or comparing alternatives. Vary which position holds the correct answer. Ground every question in the document.`;

    const response = await anthropic.beta.messages.parse({
      ...baseParams,
      max_tokens: 16000,
      output_config: { effort: COURSE_DESIGNER_EFFORT, format: betaZodOutputFormat(QuestionSetSchema) },
      system: COURSE_DESIGNER_SYSTEM,
      messages: [
        {
          role: "user",
          content: [await pdfDocumentBlock(lesson), { type: "text", text: instructions }],
        },
      ],
    });
    logUsage(`questions:${objective.id}`, response.usage);
    assertNotRefused(response);
    valid.push(...(response.parsed_output?.questions ?? []).filter(isValid).slice(0, needed));
  }

  if (valid.length < count) throw new Error(`Generated ${valid.length}/${count} valid questions`);

  const now = new Date().toISOString();
  return valid.map((q, order) => ({
    id: nanoid(10),
    objectiveId: objective.id,
    order,
    stem: q.stem,
    choices: q.choices,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    hints: q.hints,
    attempts: [],
    answeredCorrectly: false,
    answeredAt: null,
    hintsShown: 0,
    xpAwarded: null,
    createdAt: now,
  }));
}
