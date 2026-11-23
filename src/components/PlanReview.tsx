"use client";

import { useState } from "react";
import type { LessonPlan } from "@/lib/types";
import { DifficultyBadge } from "./DifficultyBadge";

/**
 * HITL approval widget. The learner can drop/reorder objectives and approve,
 * or send free-text feedback for the agent to redraft the plan.
 */
export function PlanReview({
  plan,
  onApprove,
  onRevise,
}: {
  plan: LessonPlan;
  onApprove: (objectiveIds: string[]) => void;
  onRevise: (feedback: string) => void;
}) {
  const [order, setOrder] = useState(plan.objectives.map((o) => o.id));
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState("");
  const byId = new Map(plan.objectives.map((o) => [o.id, o]));
  const selected = order.filter((id) => !excluded.has(id));

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  function toggle(id: string) {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExcluded(next);
  }

  return (
    <section>
      <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Proposed learning plan · review before we start</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{plan.title}</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">{plan.overview}</p>

      <ol className="mt-8 space-y-3">
        {order.map((id, i) => {
          const o = byId.get(id)!;
          const off = excluded.has(id);
          return (
            <li
              key={id}
              className={`rounded-xl border p-4 transition ${
                off ? "border-dashed border-zinc-300 opacity-50 dark:border-zinc-700" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={!off}
                  onChange={() => toggle(id)}
                  className="mt-1.5 h-4 w-4 accent-indigo-600"
                  aria-label={`Include ${o.title}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{o.title}</h3>
                    <DifficultyBadge difficulty={o.difficulty} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{o.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.keyConcepts.map((c) => (
                      <span key={c} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="px-2 text-zinc-400 hover:text-zinc-700 disabled:opacity-30" aria-label="Move up">
                    ▲
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === order.length - 1} className="px-2 text-zinc-400 hover:text-zinc-700 disabled:opacity-30" aria-label="Move down">
                    ▼
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label htmlFor="feedback" className="text-sm font-medium">
          Want something different?
        </label>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          placeholder="e.g. Focus more on the practical examples, and make it a bit harder."
          className="mt-2 w-full resize-none rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
        />
        <button
          onClick={() => onRevise(feedback.trim())}
          disabled={!feedback.trim()}
          className="mt-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Ask the agent to revise
        </button>
      </div>

      <button
        onClick={() => onApprove(selected)}
        disabled={selected.length === 0}
        className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        Approve plan & start ({selected.length} objective{selected.length === 1 ? "" : "s"})
      </button>
    </section>
  );
}
