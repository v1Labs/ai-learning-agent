import type { PublicCard, XpProgress } from "@/lib/types";
import { XP_LEVELS } from "@/lib/gamification";
import { KIND_LABEL } from "./DiscoveryCard";

/** XP at which each level starts (level 0 starts at 0). */
const LEVEL_XP = [0, ...XP_LEVELS.map((l) => l.xp)];

/**
 * XP score, progress to the next card, and the card collection.
 * While `celebrating`, the bar holds at 100% and the new card stays hidden
 * until it flies into its slot (ADR 0014).
 */
export function XpBar({
  progress,
  cards,
  onOpenCard,
  celebrating,
  highlightCardId,
}: {
  progress: XpProgress;
  cards: PublicCard[];
  onOpenCard: (id: string) => void;
  celebrating: { level: number; cardId: string | null } | null;
  highlightCardId: string | null;
}) {
  const { xp, next } = progress;
  const level = celebrating ? celebrating.level - 1 : progress.level;
  let pct = 100;
  let label = "All cards collected!";
  if (celebrating) {
    label = "Level up!";
  } else if (next?.xpNeeded != null) {
    const floor = LEVEL_XP[progress.level] ?? 0;
    pct = Math.round(((xp - floor) / (xp + next.xpNeeded - floor)) * 100);
    label = `${next.xpNeeded} XP to your next card`;
  } else if (next?.questionsLeft != null) {
    label = `Finish the lesson (${next.questionsLeft} question${next.questionsLeft === 1 ? "" : "s"}) for your final card`;
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <div
          key={level}
          className="flex h-10 w-10 animate-[pop_400ms_ease-out] items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white"
        >
          {level}
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">{xp} XP</div>
          <div className="text-xs text-zinc-500">Level {level}</div>
        </div>
      </div>

      <div className="min-w-40 flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full bg-amber-400 transition-all duration-700 ${celebrating ? "animate-pulse shadow-[0_0_12px_rgb(251_191_36)]" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={`mt-1 text-xs ${celebrating ? "font-semibold text-amber-600" : "text-zinc-500"}`}>{label}</div>
      </div>

      <div className="flex gap-1.5" aria-label="Discovery cards">
        {cards.map((c) => {
          const hidden = c.state === "locked" || celebrating?.cardId === c.id;
          const pop = highlightCardId === c.id ? "animate-[slot-pop_600ms_ease-out]" : "";
          return hidden ? (
            <div
              key={c.id}
              data-card-slot={c.id}
              title={`Level ${c.level} card: locked`}
              className="flex h-12 w-9 items-center justify-center rounded-md border-2 border-dashed border-zinc-300 text-xs font-semibold text-zinc-400 dark:border-zinc-700"
            >
              {c.level}
            </div>
          ) : (
            <button
              key={c.id}
              data-card-slot={c.id}
              onClick={() => onOpenCard(c.id)}
              title={c.state === "revealed" ? (c.title ?? "") : "Researching…"}
              aria-label={`Open ${KIND_LABEL[c.kind]} card`}
              className={`relative flex h-12 w-9 flex-col items-center justify-center overflow-hidden rounded-md border-2 border-orange-600 bg-orange-500 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 ${pop}`}
            >
              {c.state === "researching" && <span aria-hidden className="shimmer absolute inset-0" />}
              <span className="relative">{c.level}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
