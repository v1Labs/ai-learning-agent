import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { nanoid } from "nanoid";
import { anthropic, assertNotRefused, baseParams, COURSE_DESIGNER_SYSTEM, pdfDocumentBlock } from "../claude";
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

/** Generates the next MCQ for an objective, avoiding repeats of earlier questions. */
export async function generateQuestion(lesson: Lesson, objective: Objective): Promise<Question> {
  const previous = lesson.questions.filter((q) => q.objectiveId === objective.id).map((q) => `- ${q.stem}`);

  const instructions = `Write one multiple-choice question assessing this learning objective.

<objective difficulty="${objective.difficulty}">
${objective.title}
${objective.description}
Key concepts: ${objective.keyConcepts.join(", ")}
</objective>
${
  previous.length
    ? `\nThe learner has already answered these questions for this objective. Assess a different concept or angle:\n${previous.join("\n")}\n`
    : ""
}
Match the ${objective.difficulty} difficulty: beginner = recall and recognition, intermediate = application, advanced = analysis or comparing alternatives. Ground the question in the document.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.beta.messages.parse({
      ...baseParams,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(QuestionSchema) },
      system: COURSE_DESIGNER_SYSTEM,
      messages: [
        {
          role: "user",
          content: [await pdfDocumentBlock(lesson.id, lesson.fileName), { type: "text", text: instructions }],
        },
      ],
    });
    assertNotRefused(response);
    const q = response.parsed_output;
    // Schema can't express "exactly 4" / index-in-range under strict decoding,
    // so validate here and regenerate once if the model got it wrong.
    if (q && q.choices.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4 && q.hints.length >= 1) {
      return {
        id: nanoid(10),
        objectiveId: objective.id,
        stem: q.stem,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        hints: q.hints,
        attempts: [],
        answeredCorrectly: false,
        hintsShown: 0,
        createdAt: new Date().toISOString(),
      };
    }
  }
  throw new Error("Failed to generate a valid question");
}
