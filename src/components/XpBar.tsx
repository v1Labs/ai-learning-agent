import type { PublicCard, XpProgress } from "@/lib/types";
import { KIND_LABEL } from "./DiscoveryCard";

const LEVEL_XP = [0, 25, 70]; // keep in sync with XP_LEVELS (src/lib/gamification.ts)

/** XP score, progress to the next card, and the card collection. */
export function XpBar({
  progress,
  cards,
  onOpenCard,
}: {
  progress: XpProgress;
  cards: PublicCard[];
  onOpenCard: (id: string) => void;
}) {
  const { xp, level, next } = progress;
  let pct = 100;
  let label = "All cards collected!";
  if (next?.xpNeeded != null) {
    const floor = LEVEL_XP[level] ?? 0;
    const ceil = floor + (xp - floor) + next.xpNeeded;
    pct = Math.round(((xp - floor) / (ceil - floor)) * 100);
    label = `${next.xpNeeded} XP to your next card`;
  } else if (next?.questionsLeft != null) {
    pct = 100;
    label = `Finish the lesson (${next.questionsLeft} question${next.questionsLeft === 1 ? "" : "s"}) for your final card`;
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
          {level}
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">{xp} XP</div>
          <div className="text-xs text-zinc-500">Level {level}</div>
        </div>
      </div>

      <div className="min-w-40 flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-xs text-zinc-500">{label}</div>
      </div>

      <div className="flex gap-1.5" aria-label="Discovery cards">
        {cards.map((c) =>
          c.state === "locked" ? (
            <div
              key={c.id}
              title={`Level ${c.level} card: locked`}
              className="flex h-12 w-9 items-center justify-center rounded-md border-2 border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700"
            >
              {c.level}
            </div>
          ) : (
            <button
              key={c.id}
              onClick={() => onOpenCard(c.id)}
              title={c.state === "revealed" ? (c.title ?? "") : "Researching…"}
              className="flex h-12 w-9 items-center justify-center rounded-md bg-gradient-to-br from-amber-300 to-orange-500 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5"
              aria-label={`${KIND_LABEL[c.kind]} card`}
            >
              {c.state === "researching" ? <span className="animate-pulse">…</span> : "★"}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
