"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AccessForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      // Only follow same-site paths.
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } else {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input
        type="password"
        autoComplete="off"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Access code"
        className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-zinc-700"
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={!code || busy}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
