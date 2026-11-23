// Thin typed client for the lesson API (browser side).
import { upload, uploadPresigned } from "@vercel/blob/client";
import { describeHttpError, preflightUpload } from "./errors";
import type { AnswerResult, PublicLesson } from "./types";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(describeHttpError(res.status, data));
  return data as T;
}

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

export const api = {
  /**
   * Deployed: upload straight to private Vercel Blob (no function body-size
   * limit), then register it. Local: plain multipart upload (ADR 0019).
   * The mode is asked of the server at upload time, so connecting storage
   * never requires a rebuild.
   */
  async upload(file: File, opts: { onProgress?: (pct: number) => void } = {}) {
    const { blobUploads, blobMode } = await json<{ blobUploads: boolean; blobMode: "token" | "oidc" | null }>(
      await fetch("/api/upload", { cache: "no-store" }),
    );
    const problem = preflightUpload(file, blobUploads);
    if (problem) throw new Error(problem);
    if (!blobUploads) {
      const fd = new FormData();
      fd.append("file", file);
      return json<{ id: string }>(await fetch("/api/lessons", { method: "POST", body: fd }));
    }
    // OIDC-authenticated stores use presigned URLs; token stores use client tokens.
    const uploadFn = blobMode === "oidc" ? uploadPresigned : upload;
    const blob = await uploadFn(file.name, file, {
      access: "private",
      handleUploadUrl: "/api/upload",
      contentType: "application/pdf",
      multipart: file.size > 5 * 1024 * 1024,
      onUploadProgress: (e) => opts.onProgress?.(Math.round(e.percentage)),
    });
    return json<{ id: string }>(await post("/api/lessons", { blobUrl: blob.url, fileName: file.name }));
  },
  get: async (id: string) => json<PublicLesson>(await fetch(`/api/lessons/${id}`, { cache: "no-store" })),
  draftPlan: async (id: string) => json<PublicLesson>(await post(`/api/lessons/${id}/plan`, { action: "draft" })),
  revisePlan: async (id: string, feedback: string) =>
    json<PublicLesson>(await post(`/api/lessons/${id}/plan`, { action: "revise", feedback })),
  approvePlan: async (id: string, objectiveIds: string[]) =>
    json<PublicLesson>(await post(`/api/lessons/${id}/plan`, { action: "approve", objectiveIds })),
  /** Resumes or retries background quiz/card generation (idempotent). */
  generate: async (id: string) => json<PublicLesson>(await post(`/api/lessons/${id}/generate`)),
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
