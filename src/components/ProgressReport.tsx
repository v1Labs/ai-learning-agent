import Link from "next/link";
import type { PublicLesson } from "@/lib/types";
import { DiscoveryCard } from "./DiscoveryCard";

export function ProgressReport({ lesson }: { lesson: PublicLesson }) {
  const report = lesson.report!;
  const total = lesson.stats.reduce((n, s) => n + s.questions, 0);
  const firstTry = lesson.stats.reduce((n, s) => n + s.firstTryCorrect, 0);
  const hints = lesson.stats.reduce((n, s) => n + s.hintsUsed, 0);
  const pct = total ? Math.round((firstTry / total) * 100) : 0;

  return (
    <section>
      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Lesson complete</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{report.headline}</h1>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="XP earned" value={String(lesson.progress.xp)} />
        <Stat label="First-try accuracy" value={`${pct}%`} />
        <Stat label="Questions" value={String(total)} />
        <Stat label="Hints used" value={String(hints)} />
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Objective</th>
              <th className="px-4 py-2 text-right font-medium">First try</th>
              <th className="px-4 py-2 text-right font-medium">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {lesson.stats.map((s) => (
              <tr key={s.objectiveId} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-2">{s.title}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {s.firstTryCorrect}/{s.questions}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{s.totalAttempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <List title="Strengths" items={report.strengths} tone="emerald" />
        <List title="Review next" items={report.areasToReview} tone="amber" />
      </div>
      <div className="mt-6">
        <List title="Study tips" items={report.studyTips} tone="indigo" />
      </div>

      {lesson.cards.some((c) => c.state !== "locked") && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            Your discovery cards
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {lesson.cards
              .filter((c) => c.state !== "locked")
              .map((c) => (
                <DiscoveryCard key={c.id} card={c} total={lesson.cards.length} />
              ))}
          </div>
        </div>
      )}

      <Link href="/" className="mt-10 inline-block rounded-xl border border-zinc-300 px-5 py-2.5 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
        Start a new lesson
      </Link>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

const TONES = {
  emerald: "text-emerald-700 dark:text-emerald-400",
  amber: "text-amber-700 dark:text-amber-400",
  indigo: "text-indigo-700 dark:text-indigo-400",
};

function List({ title, items, tone }: { title: string; items: string[]; tone: keyof typeof TONES }) {
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wide ${TONES[tone]}`}>{title}</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-zinc-700 dark:text-zinc-300">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
