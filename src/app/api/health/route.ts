import { connection } from "next/server";
import { blobMode, storageBackend } from "@/lib/store";

/**
 * Deployment self-check (ADR 0019): which storage this instance is using.
 * On Vercel, lessons must be in Redis; the file backend doesn't persist there.
 * Gated by the access code like everything else; reports no secrets.
 */
export async function GET() {
  await connection(); // evaluate per request, never at build time
  const onVercel = !!process.env.VERCEL;
  const problems = [
    ...(onVercel && storageBackend !== "redis" ? ["Upstash Redis is not connected; lessons won't persist on Vercel."] : []),
    ...(onVercel && !blobMode ? ["Vercel Blob is not connected; uploads over 4.5 MB will fail."] : []),
    ...(!process.env.ANTHROPIC_API_KEY ? ["ANTHROPIC_API_KEY is not set."] : []),
    ...(onVercel && !process.env.ACCESS_CODE ? ["ACCESS_CODE is not set; the deployment is open to anyone with the link."] : []),
  ];
  return Response.json(
    { ok: problems.length === 0, storage: storageBackend, blob: blobMode, accessCode: !!process.env.ACCESS_CODE, problems },
    { headers: { "Cache-Control": "no-store" } },
  );
}
