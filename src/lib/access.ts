// Shared-access-code gate (ADR 0020). Works in both the proxy and route
// handlers (Web Crypto only). Disabled when ACCESS_CODE is unset (local dev).

export const ACCESS_COOKIE = "lesson_access";

/** Cookie value: a hash of the code, so the code itself never sits in the browser. */
export async function accessToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`ai-learning-agent:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two equal-format strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
