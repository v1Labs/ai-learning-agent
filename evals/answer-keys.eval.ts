import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { beforeAll, expect, it } from "vitest";
import { z } from "zod";
import type { Lesson } from "@/lib/types";
import { buildLesson, report, requireEvalEnv } from "./setup";

// Eval: are generated answer keys correct and unambiguous? An independent
// solver answers each question from the PDF without seeing the key.

const Verdict = z.object({
  choiceIndex: z.number().int().describe("0-based index of the best answer"),
  ambiguous: z.boolean().describe("True if more than one choice is defensible, or none is correct"),
  reasoning: z.string().describe("One sentence"),
});

let lesson: Lesson;
beforeAll(async () => {
  lesson = await buildLesson(requireEvalEnv());
});

it("answer keys agree with an independent solver", async () => {
  const { anthropic, baseParams, pdfDocumentBlock } = await import("@/lib/claude");
  const pdf = await pdfDocumentBlock(lesson.id, lesson.fileName);

  const results = await Promise.all(
    lesson.questions.map(async (q) => {
      const res = await anthropic.beta.messages.parse({
        ...baseParams,
        max_tokens: 4000,
        output_config: { effort: "medium", format: betaZodOutputFormat(Verdict) },
        messages: [
          {
            role: "user",
            content: [
              pdf,
              {
                type: "text",
                text: `Answer this multiple-choice question using the document.\n\n${q.stem}\n${q.choices.map((c, i) => `${i}. ${c}`).join("\n")}`,
              },
            ],
          },
        ],
      });
      const v = res.parsed_output!;
      return { question: q.stem.slice(0, 70), key: q.correctIndex, solver: v.choiceIndex, ambiguous: v.ambiguous, agree: v.choiceIndex === q.correctIndex && !v.ambiguous, note: v.reasoning.slice(0, 80) };
    }),
  );

  report("Answer-key validity", results);
  const rate = results.filter((r) => r.agree).length / results.length;
  console.log(`Agreement: ${(rate * 100).toFixed(0)}% (${results.length} questions)`);
  // Bar: at least 9 in 10 keys confirmed. Disagreements are listed above for review.
  expect(rate).toBeGreaterThanOrEqual(0.9);
});
