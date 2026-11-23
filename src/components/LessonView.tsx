"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PublicLesson } from "@/lib/types";
import { PlanReview } from "./PlanReview";
import { ProgressReport } from "./ProgressReport";
import { ObjectiveStepper } from "./ObjectiveStepper";
import { QuizWidget } from "./QuizWidget";
import { TutorChat } from "./TutorChat";
import { Spinner } from "./Spinner";

/** Orchestrates the lesson phases. The server owns state; this renders whatever phase it reports. */
export function LessonView({ initial }: { initial: PublicLesson }) {
  const [lesson, setLesson] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  // After the last answer we keep showing the quiz (with its explanation) until the learner moves on.
  const [showReport, setShowReport] = useState(initial.phase === "complete");
  const inflight = useRef(false);

  const run = useCallback(async (label: string, fn: () => Promise<PublicLesson>) => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(label);
    setError(null);
    try {
      setLesson(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inflight.current = false;
      setLoading(null);
    }
  }, []);

  // Auto-advance through the agent-driven steps. This syncs with an external
  // system (the server-side state machine), which is what effects are for.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (lesson.phase === "planning") run("Reading your PDF and drafting a learning plan…", () => api.draftPlan(lesson.id));
    else if (lesson.phase === "learning" && !lesson.currentQuestion)
      run("Writing your first question…", () => api.nextQuestion(lesson.id));
    else if (lesson.phase === "complete" && showReport && !lesson.report)
      run("Preparing your progress report…", () => api.report(lesson.id));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lesson.phase, lesson.currentQuestion, lesson.report, lesson.id, showReport, run]);

  const refresh = useCallback(async () => setLesson(await api.get(lesson.id)), [lesson.id]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link href="/" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          AI Learning Agent
        </Link>
        <span className="truncate pl-4 text-sm text-zinc-500">{lesson.plan?.title ?? lesson.fileName}</span>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_380px]">
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          {lesson.plan && lesson.phase !== "awaiting_approval" && (
            <ObjectiveStepper lesson={lesson} />
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {error}{" "}
              <button className="underline" onClick={() => refresh().then(() => setError(null))}>
                Retry
              </button>
            </div>
          )}

          {loading && <Spinner label={loading} />}

          {!loading && lesson.phase === "awaiting_approval" && lesson.plan && (
            <PlanReview
              plan={lesson.plan}
              onRevise={(feedback) => run("Revising the plan…", () => api.revisePlan(lesson.id, feedback))}
              onApprove={(ids) => run("Starting your lesson…", () => api.approvePlan(lesson.id, ids))}
            />
          )}

          {!loading && (lesson.phase === "learning" || (lesson.phase === "complete" && !showReport)) &&
            lesson.currentQuestion && (
              <QuizWidget
                key={lesson.currentQuestion.id}
                lessonId={lesson.id}
                question={lesson.currentQuestion}
                objective={lesson.plan?.objectives.find((o) => o.id === lesson.currentQuestion!.objectiveId)}
                isLast={lesson.phase === "complete"}
                onAnswered={(l) => setLesson(l)}
                onNext={() =>
                  lesson.phase === "complete"
                    ? setShowReport(true)
                    : run("Writing your next question…", () => api.nextQuestion(lesson.id))
                }
              />
            )}

          {!loading && lesson.phase === "complete" && showReport && lesson.report && <ProgressReport lesson={lesson} />}
        </main>

        <aside className="border-t border-zinc-200 lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-t-0 dark:border-zinc-800">
          <TutorChat lesson={lesson} onTurnComplete={refresh} />
        </aside>
      </div>
    </div>
  );
}
