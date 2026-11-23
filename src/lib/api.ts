// Thin typed client for the lesson API (browser side).
import type { AnswerResult, PublicLesson } from "./types";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

export const api = {
  async upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    return json<{ id: string }>(await fetch("/api/lessons", { method: "POST", body: fd }));
  },
  get: async (id: string) => json<PublicLesson>(await fetch(`/api/lessons/${id}`, { cache: "no-store" })),
  draftPlan: async (id: string) => json<PublicLesson>(await post(`/api/lessons/${id}/plan`, { action: "draft" })),
  revisePlan: async (id: string, feedback: string) =>
    json<PublicLesson>(await post(`/api/lessons/${id}/plan`, { action: "revise", feedback })),
  approvePlan: async (id: string, objectiveIds: string[]) =>
    json<PublicLesson>(await post(`/api/lessons/${id}/plan`, { action: "approve", objectiveIds })),
  nextQuestion: async (id: string) => json<PublicLesson>(await post(`/api/lessons/${id}/question`)),
  answer: async (id: string, questionId: string, choiceIndex: number) =>
    json<AnswerResult>(await post(`/api/lessons/${id}/answer`, { questionId, choiceIndex })),
  report: async (id: string) => json<PublicLesson>(await post(`/api/lessons/${id}/report`)),

  /** Streams the tutor's reply, calling onDelta for each chunk. */
  async chat(id: string, message: string, onDelta: (text: string) => void) {
    const res = await post(`/api/lessons/${id}/chat`, { message });
    if (!res.ok || !res.body) {
      await json(res);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onDelta(decoder.decode(value, { stream: true }));
    }
  },
};
