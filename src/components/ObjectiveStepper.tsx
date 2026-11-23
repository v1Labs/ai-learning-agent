import type { PublicLesson } from "@/lib/types";

export function ObjectiveStepper({ lesson }: { lesson: PublicLesson }) {
  const objectives = lesson.plan?.objectives ?? [];
  const done = lesson.phase === "complete" ? objectives.length : lesson.currentObjectiveIndex;
  const totalQs = objectives.length * lesson.questionsPerObjective;
  const answered = lesson.stats.reduce((n, s) => n + s.questions, 0);

  return (
    <div className="mb-8">
      <div className="mb-2 flex justify-between text-xs text-zinc-500">
        <span>
          Objective {Math.min(done + 1, objectives.length)} of {objectives.length}
        </span>
        <span>
          {answered}/{totalQs} questions
        </span>
      </div>
      <div className="flex gap-1.5">
        {objectives.map((o, i) => (
          <div
            key={o.id}
            title={o.title}
            className={`h-1.5 flex-1 rounded-full ${
              i < done ? "bg-emerald-500" : i === done ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
