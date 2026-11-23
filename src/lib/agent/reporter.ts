import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, assertNotRefused, baseParams, COURSE_DESIGNER_EFFORT, COURSE_DESIGNER_SYSTEM, logUsage, pdfDocumentBlock } from "../claude";
import type { Lesson, ObjectiveStats, ProgressReport } from "../types";

const ReportSchema = z.object({
  headline: z.string().describe("One encouraging, specific sentence summarizing the learner's performance"),
  strengths: z.array(z.string()).describe("1-3 objectives or concepts the learner handled well"),
  areasToReview: z.array(z.string()).describe("1-3 concepts to revisit, based on misses and hint usage"),
  studyTips: z.array(z.string()).describe("3-5 concrete, actionable study tips tied to the document's content"),
});

/** Progress report: stats are computed deterministically; Claude writes the narrative and tips. */
export async function writeReport(lesson: Lesson, stats: ObjectiveStats[]): Promise<ProgressReport> {
  const missed = lesson.questions
    .filter((q) => q.attempts.length > 1)
    .map((q) => `- "${q.stem}" (took ${q.attempts.length} attempts, ${q.hintsShown} hints)`);

  const instructions = `The learner just finished a lesson built from this document. Write their progress report.

<per_objective_stats>
${JSON.stringify(stats, null, 2)}
</per_objective_stats>

<questions_that_needed_retries>
${missed.join("\n") || "(none: every question answered correctly on the first try)"}
</questions_that_needed_retries>

Base strengths and areas to review on the stats. Make study tips specific to the material the learner struggled with.`;

  const response = await anthropic.beta.messages.parse({
    ...baseParams,
    max_tokens: 16000,
    output_config: { effort: COURSE_DESIGNER_EFFORT, format: betaZodOutputFormat(ReportSchema) },
    system: COURSE_DESIGNER_SYSTEM,
    messages: [
      {
        role: "user",
        content: [await pdfDocumentBlock(lesson), { type: "text", text: instructions }],
      },
    ],
  });
  logUsage("report", response.usage);
  assertNotRefused(response);
  if (!response.parsed_output) throw new Error("Failed to parse progress report");
  return response.parsed_output;
}
