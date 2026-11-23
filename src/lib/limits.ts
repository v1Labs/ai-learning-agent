import "server-only";
import { incrementCounter } from "./store";

// Spend protection (ADR 0020): every new lesson triggers ~15 model calls, so
// cap how many can be created per visitor and in total each day.
const PER_IP_PER_DAY = Number(process.env.MAX_LESSONS_PER_IP_PER_DAY ?? 10);
const TOTAL_PER_DAY = Number(process.env.MAX_LESSONS_PER_DAY ?? 100);

export class RateLimitError extends Error {}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Counts a new lesson against the daily limits; throws RateLimitError when exceeded. */
export async function chargeNewLesson(req: Request) {
  const day = new Date().toISOString().slice(0, 10);
  const [ip, total] = await Promise.all([
    incrementCounter(`lessons:${day}:ip:${clientIp(req)}`, 86_400),
    incrementCounter(`lessons:${day}:total`, 86_400),
  ]);
  if (ip > PER_IP_PER_DAY) throw new RateLimitError(`Daily limit reached (${PER_IP_PER_DAY} lessons). Please try again tomorrow.`);
  if (total > TOTAL_PER_DAY) throw new RateLimitError("This demo has reached today's lesson limit. Please try again tomorrow.");
}

// The PDF is sent to Claude base64-encoded (~1.33x), and requests cap at 32 MB.
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
// Claude accepts up to 600 pages, but a lesson works best from a chapter-sized
// document: planning stays fast and per-lesson cost stays predictable (ADR 0011).
export const MAX_PDF_PAGES = Number(process.env.MAX_PDF_PAGES ?? 100);
