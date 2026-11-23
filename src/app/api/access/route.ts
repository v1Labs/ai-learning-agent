import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";
import { incrementCounter } from "@/lib/store";
import { clientIp } from "@/lib/limits";

/** Checks the shared access code and sets an HTTP-only cookie (ADR 0020). */
export async function POST(req: Request) {
  const expected = process.env.ACCESS_CODE;
  if (!expected) return Response.json({ ok: true });

  // Slow down guessing: 10 attempts per IP per 15 minutes.
  if ((await incrementCounter(`access:${clientIp(req)}`, 900)) > 10) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const [given, want] = await Promise.all([accessToken(code ?? ""), accessToken(expected)]);
  if (!safeEqual(given, want)) return Response.json({ error: "That code isn't right." }, { status: 401 });

  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${ACCESS_COOKIE}=${want}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return res;
}
