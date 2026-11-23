"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, PublicLesson } from "@/lib/types";

const SUGGESTIONS = ["Can I get a hint?", "Explain this concept another way", "Why does this matter?"];

export function TutorChat({ lesson, onTurnComplete }: { lesson: PublicLesson; onTurnComplete: () => Promise<void> }) {
  const [messages, setMessages] = useState<ChatMessage[]>(lesson.chat);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Braces matter: newer browsers return a Promise from smooth scrollIntoView,
  // and an effect may only return a cleanup function.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const enabled = lesson.phase !== "planning";

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    setStreaming(true);
    const at = new Date().toISOString();
    setMessages((m) => [...m, { role: "user", content: message, at }, { role: "assistant", content: "", at }]);
    try {
      await api.chat(lesson.id, message, (delta) =>
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + delta };
          return next;
        }),
      );
      await onTurnComplete(); // tutor may have revealed a hint; resync the quiz widget
    } catch (e) {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: `⚠️ ${(e as Error).message}`, at }]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full max-h-screen flex-col">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">Tutor</h2>
        <p className="text-xs text-zinc-500">Ask for hints or explanations. The tutor won&apos;t give away answers.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            {enabled ? "Stuck, or curious to go deeper? Ask me anything about the material." : "I'll be here once your plan is ready."}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {m.content || <span className="animate-pulse">…</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {enabled && lesson.phase === "learning" && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={streaming}
                className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!enabled || streaming}
            placeholder={enabled ? "Ask the tutor…" : "Waiting for the plan…"}
            className="flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={!enabled || streaming || !input.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
