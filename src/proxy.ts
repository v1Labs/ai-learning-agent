import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";

/**
 * Gates the whole app behind a shared access code when ACCESS_CODE is set
 * (ADR 0020), so a shared demo link can't be used to run up API spend.
 * Pages redirect to /access; API calls get a 401.
 */
export async function proxy(req: NextRequest) {
  const code = process.env.ACCESS_CODE;
  if (!code) return NextResponse.next();

  const cookie = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await accessToken(code))) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Access code required" }, { status: 401 });
  }
  const url = new URL("/access", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the access page itself, its API route and static assets.
  matcher: ["/((?!access|api/access|_next/static|_next/image|favicon.ico).*)"],
};
