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
 * Shared system prompt for the structured-output calls (plan, questions,
 * report). Keeping it byte-identical, and putting task-specific instructions
 * *after* the PDF, lets those calls share one cached prefix: system -> PDF.
 */
export const COURSE_DESIGNER_SYSTEM = `You are an expert instructional designer and tutor working from a single source document supplied by the learner. Ground everything you produce in that document. Write clearly and concisely for an adult learner.`;

/**
 * The source PDF as a document block, marked for prompt caching, so the PDF
 * is billed at full price once per lesson and read from cache afterwards.
 */
export async function pdfDocumentBlock(
  lesson: PdfRef & { fileName: string },
): Promise<Anthropic.Beta.BetaRequestDocumentBlock> {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: await getPdfBase64(lesson) },
    title: lesson.fileName,
    cache_control: { type: "ephemeral" },
  };
}
