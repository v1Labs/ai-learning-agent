import type { Difficulty } from "@/lib/types";

const STYLES: Record<Difficulty, string> = {
  beginner: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  advanced: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[difficulty]}`}>{difficulty}</span>;
}
