"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { TUTOR } from "@/lib/persona";
import type { ChatMessage, PublicLesson } from "@/lib/types";
import { TutorAvatar } from "./TutorAvatar";

const SUGGESTIONS = ["Can I get a hint?", "Explain this concept another way", "Why does this matter?"];

export function TutorChat({ lesson, onTurnComplete }: { lesson: PublicLesson; onTurnComplete: () => Promise<void> }) {
  const [messages, setMessages] = useState<ChatMessage[]>(lesson.chat);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll only the message list. scrollIntoView would also scroll the page.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const enabled = lesson.phase !== "planning";
  const thinking = streaming && messages.at(-1)?.content === "";

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
      await onTurnComplete(); // the tutor may have revealed a hint; resync the quiz widget
    } catch (e) {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: `⚠️ ${(e as Error).message}`, at }]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <TutorAvatar size={40} thinking={thinking} />
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight">{TUTOR.name}</h2>
          <p className="truncate text-xs text-zinc-500">
            {thinking ? "Thinking…" : `${TUTOR.tagline} · hints, never answers`}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <Bubble role="assistant">{enabled ? TUTOR.greeting : TUTOR.waitingGreeting}</Bubble>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.content || <TypingDots />}
          </Bubble>
        ))}
      </div>

      <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
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
            placeholder={enabled ? `Ask ${TUTOR.name}…` : "Waiting for the plan…"}
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-700"
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

function Bubble({ role, children }: { role: ChatMessage["role"]; children: React.ReactNode }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2 text-sm text-white">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <TutorAvatar size={28} />
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-zinc-100 px-3.5 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
        {children}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label={`${TUTOR.name} is typing`}>
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}
