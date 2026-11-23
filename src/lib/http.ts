import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ModelRefusalError } from "./claude";
import { PhaseError } from "./lesson";
import { NotFoundError } from "./store";

/** Maps domain/SDK errors to HTTP responses so route handlers stay thin. */
export function errorResponse(err: unknown): Response {
  if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
  if (err instanceof PhaseError) return Response.json({ error: err.message }, { status: 409 });
  if (err instanceof ModelRefusalError) return Response.json({ error: err.message }, { status: 422 });
  if (err instanceof Anthropic.RateLimitError)
    return Response.json({ error: "The AI service is busy. Please retry in a moment." }, { status: 429 });
  if (err instanceof Anthropic.AuthenticationError)
    return Response.json({ error: "Server is missing a valid ANTHROPIC_API_KEY." }, { status: 500 });
  if (err instanceof Anthropic.APIError)
    return Response.json({ error: `AI service error (${err.status})` }, { status: 502 });
  console.error(err);
  return Response.json(
    { error: "Unexpected server error. Check the server logs (is ANTHROPIC_API_KEY set?)." },
    { status: 500 },
  );
}
