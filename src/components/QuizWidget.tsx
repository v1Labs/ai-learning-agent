"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Objective, PublicLesson, PublicQuestion } from "@/lib/types";
import { DifficultyBadge } from "./DifficultyBadge";

const LETTERS = "ABCDEFGH";

/**
 * MCQ widget. Grading happens server-side; this only renders state:
 * wrong attempts stay red (and locked), the correct choice turns green with
 * the explanation, and hints accumulate as the learner retries.
 */
export function QuizWidget({
  lessonId,
  question,
  objective,
  isLast,
  onAnswered,
  onNext,
}: {
  lessonId: string;
  question: PublicQuestion;
  objective?: Objective;
  isLast: boolean;
  onAnswered: (lesson: PublicLesson) => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastWrong, setLastWrong] = useState(false);

  const done = question.answeredCorrectly;
  const wrong = new Set(question.wrongAttempts);

  async function submit() {
    if (selected === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.answer(lessonId, question.id, selected);
      setLastWrong(!result.correct);
      if (!result.correct) setSelected(null);
      onAnswered(result.lesson);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-800">
      {objective && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <span>{objective.title}</span>
          <DifficultyBadge difficulty={objective.difficulty} />
        </div>
      )}
      <h2 className="text-xl font-medium leading-snug">{question.stem}</h2>

      <div className="mt-6 space-y-2.5" role="radiogroup">
        {question.choices.map((choice, i) => {
          const isCorrect = done && question.correctIndex === i;
          const isWrong = wrong.has(i);
          const isSelected = selected === i;
          const locked = done || isWrong || submitting;
          const style = isCorrect
            ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
            : isWrong
              ? "border-rose-400 bg-rose-50 text-rose-900 line-through decoration-rose-400/60 dark:bg-rose-950/40 dark:text-rose-200"
              : isSelected
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500";
          return (
            <button
              key={i}
              role="radio"
              aria-checked={isSelected}
              disabled={locked}
              onClick={() => setSelected(i)}
              className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition disabled:cursor-default ${style}`}
            >
              <span className="mt-px font-mono text-sm font-semibold opacity-70">{LETTERS[i]}</span>
              <span className="flex-1">{choice}</span>
              {isCorrect && <span aria-label="correct">✓</span>}
              {isWrong && <span aria-label="incorrect">✗</span>}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {done && question.explanation && (
        <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">Correct!</p>
          <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100">{question.explanation}</p>
        </div>
      )}
      {!done && question.hintsShown.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            {lastWrong ? "Not quite. Here's a hint:" : "Hints"}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
            {question.hintsShown.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}
      {!done && lastWrong && question.hintsShown.length === 0 && (
        <p className="mt-6 text-sm text-rose-700 dark:text-rose-300">Not quite. Try again.</p>
      )}
      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      <div className="mt-6 flex justify-end">
        {done ? (
          <button onClick={onNext} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500">
            {isLast ? "See my progress report →" : "Next question →"}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={selected === null || submitting}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? "Checking…" : wrong.size > 0 ? "Try again" : "Submit"}
          </button>
        )}
      </div>
    </section>
  );
}
