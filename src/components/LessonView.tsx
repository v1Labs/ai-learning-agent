"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AnswerResult, PublicLesson, PublicQuestion } from "@/lib/types";
import { CardModal, prefersReducedMotion } from "./CardModal";
import { PlanReview } from "./PlanReview";
import { ProgressReport } from "./ProgressReport";
import { QuestionProgress } from "./QuestionProgress";
import { QuizWidget } from "./QuizWidget";
import { Spinner } from "./Spinner";
import { TutorChat } from "./TutorChat";
import { XpBar } from "./XpBar";

/** Orchestrates the lesson phases. The server owns state; this renders whatever phase it reports. */
export function LessonView({ initial }: { initial: PublicLesson }) {
  const [lesson, setLesson] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  // A just-answered question stays on screen (with its explanation) until the learner clicks Next.
  const [answered, setAnswered] = useState<PublicQuestion | null>(null);
  // Card modal: opened by a level-up, or by clicking a collected card.
  // Level-up sequence (ADR 0014): `celebrating` starts on the correct answer
  // (XP bar fills, new card hidden), then the modal opens after a beat.
  const [celebrating, setCelebrating] = useState<{ level: number; cardId: string | null } | null>(null);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [viewCardId, setViewCardId] = useState<string | null>(null);
  const [justCollectedId, setJustCollectedId] = useState<string | null>(null);
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

  const refresh = useCallback(async () => setLesson(await api.get(lesson.id)), [lesson.id]);

  // Auto-advance through the agent-driven steps. This syncs with an external
  // system (the server-side state machine), which is what effects are for.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (lesson.phase === "planning") run("Reading your PDF and drafting a learning plan…", () => api.draftPlan(lesson.id));
    else if (lesson.phase === "complete" && showReport && !lesson.report)
      run("Preparing your progress report…", () => api.report(lesson.id));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lesson.phase, lesson.report, lesson.id, showReport, run]);

  // On load, make sure background generation is running (resumes after a server restart).
  useEffect(() => {
    if (initial.phase === "learning" || initial.phase === "complete") api.generate(initial.id).catch(() => {});
  }, [initial.id, initial.phase]);

  // Poll while we're waiting on background work the learner can see.
  const openCardId = levelUpOpen ? (celebrating?.cardId ?? null) : viewCardId;
  const openCard = lesson.cards.find((c) => c.id === openCardId);
  const waiting = (!answered && lesson.waitingOn?.status === "pending") || openCard?.state === "researching";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => refresh().catch(() => {}), 1500);
    return () => clearInterval(t);
  }, [waiting, refresh]);

  function onAnswered(result: AnswerResult) {
    setLesson(result.lesson);
    if (result.correct) setAnswered(result.question);
    if (result.levelUp?.cardId) {
      const levelUp = result.levelUp;
      setCelebrating(levelUp);
      // Let the green answer and "+XP" land before interrupting.
      setTimeout(() => setLevelUpOpen(true), prefersReducedMotion() ? 0 : 900);
    }
  }

  function onNext() {
    setAnswered(null);
    if (lesson.phase === "complete") setShowReport(true);
  }

  const question = answered ?? lesson.activeQuestion;
  const inQuiz = lesson.phase === "learning" || (lesson.phase === "complete" && !showReport);

  return (
    // Desktop: an app shell. The header stays put, the lesson column scrolls on its own,
    // and the tutor fills exactly the remaining height. Mobile: normal page flow.
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Link href="/" className="shrink-0 whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          AI Learning Agent
        </Link>
        <span className="truncate pl-4 text-sm text-zinc-500">{lesson.plan?.title ?? lesson.fileName}</span>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[1fr_380px]">
        <div className="lg:min-h-0 lg:overflow-y-auto">
          <main className="mx-auto w-full max-w-3xl px-4 py-8">
            {lesson.phase !== "planning" && lesson.phase !== "awaiting_approval" && (
              <div className="mb-8 space-y-4">
                <XpBar
                  progress={lesson.progress}
                  cards={lesson.cards}
                  onOpenCard={setViewCardId}
                  celebrating={celebrating}
                  highlightCardId={justCollectedId}
                />
                <QuestionProgress answered={lesson.answeredQuestions} total={lesson.totalQuestions} />
              </div>
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

            {!loading && inQuiz && question && (
              <QuizWidget
                key={question.id}
                lessonId={lesson.id}
                question={question}
                total={lesson.totalQuestions}
                objective={lesson.plan?.objectives.find((o) => o.id === question.objectiveId)}
                isLast={lesson.phase === "complete"}
                onAnswered={onAnswered}
                onNext={onNext}
              />
            )}

            {!loading && inQuiz && !question && lesson.waitingOn?.status === "pending" && (
              <Spinner
                label={lesson.answeredQuestions === 0 ? "Writing your questions…" : "Finishing the next set of questions…"}
              />
            )}

            {!loading && inQuiz && !question && lesson.waitingOn?.status === "failed" && (
              <div className="rounded-xl border border-rose-300 p-5 text-sm dark:border-rose-800">
                Something went wrong writing these questions.{" "}
                <button className="font-medium underline" onClick={() => run("Retrying…", () => api.generate(lesson.id))}>
                  Try again
                </button>
              </div>
            )}

            {!loading && lesson.phase === "complete" && showReport && lesson.report && <ProgressReport lesson={lesson} />}
          </main>
        </div>

        <aside className="h-[32rem] border-t border-zinc-200 lg:h-auto lg:min-h-0 lg:border-l lg:border-t-0 dark:border-zinc-800">
          <TutorChat lesson={lesson} onTurnComplete={refresh} />
        </aside>
      </div>

      {openCard && (
        <CardModal
          key={openCard.id}
          card={openCard}
          total={lesson.cards.length}
          levelUp={levelUpOpen ? (celebrating?.level ?? null) : null}
          onClose={() => {
            if (levelUpOpen) {
              setJustCollectedId(celebrating?.cardId ?? null);
              setTimeout(() => setJustCollectedId(null), 700);
              setCelebrating(null);
              setLevelUpOpen(false);
            } else {
              setViewCardId(null);
            }
          }}
        />
      )}
    </div>
  );
}
