import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getPdfBase64, type PdfRef } from "./store";

// Credentials resolve from ANTHROPIC_API_KEY (or an `ant auth login` profile).
export const anthropic = new Anthropic();

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

/**
 * Params shared by every request. Server-side fallbacks re-run a request on
 * Anthropic's recommended fallback model if a safety classifier declines it,
 * so a false positive on study material doesn't dead-end the lesson.
 */
export const baseParams: Pick<Anthropic.Beta.MessageCreateParamsNonStreaming, "model" | "betas" | "fallbacks"> = {
  model: MODEL,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

export class ModelRefusalError extends Error {
  constructor() {
    super("The model declined to process this request.");
  }
}

/** Throws if the response was declined; call before reading content. */
export function assertNotRefused(message: { stop_reason: string | null }) {
  if (message.stop_reason === "refusal") throw new ModelRefusalError();
}

/**
 * Effort for every call that shares the system -> PDF prefix. Effort is
 * rendered into the prompt, so changing it between calls misses the cache
 * (ADR 0022); keep it identical across planner, quizmaster, reporter and
 * the PDF-only card fallback.
 */
export const COURSE_DESIGNER_EFFORT = "medium" as const;

/** Logs token and cache usage per call, so cache hits can be checked in server logs. */
export function logUsage(label: string, usage: Anthropic.Beta.BetaUsage) {
  console.info(
    `[claude] ${label}: input=${usage.input_tokens} cache_write=${usage.cache_creation_input_tokens ?? 0} cache_read=${usage.cache_read_input_tokens ?? 0} output=${usage.output_tokens}`,
  );
}

/**
 * Shared system prompt for the structured-output calls (plan, questions,
 * report). Keeping it byte-identical, and putting task-specific instructions
 * *after* the PDF, lets those calls share one cached prefix: system -> PDF.
 */
export const COURSE_DESIGNER_SYSTEM = `You are an expert instructional designer and tutor working from a single source document supplied by the learner. Ground everything you produce in that document. Write clearly and concisely for an adult learner.`;

/**
 * The source PDF as a document block, marked for prompt caching with a 1-hour
 * TTL (ADR 0022): a lesson spans plan review, the quiz and the report, often
 * with pauses longer than the default 5 minutes, so one 2x write beats
 * repeated 1.25x writes. Longer TTLs must precede shorter ones in a request,
 * which holds because the PDF is the first breakpoint everywhere.
 */
export async function pdfDocumentBlock(
  lesson: PdfRef & { fileName: string },
): Promise<Anthropic.Beta.BetaRequestDocumentBlock> {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: await getPdfBase64(lesson) },
    title: lesson.fileName,
    cache_control: { type: "ephemeral", ttl: "1h" },
  };
}
