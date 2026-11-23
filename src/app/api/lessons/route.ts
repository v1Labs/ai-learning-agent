import { nanoid } from "nanoid";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { chargeNewLesson, MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/lib/limits";
import { deleteBlobQuietly, readBlob, saveLesson, savePdf, usesBlob } from "@/lib/store";
import type { Lesson } from "@/lib/types";

export const maxDuration = 60;

const BlobBody = z.object({ blobUrl: z.string().url(), fileName: z.string().max(300) });

/**
 * Creates a lesson from a PDF. Two upload paths (ADR 0019):
 *  - Deployed: the browser uploads straight to private Vercel Blob (bypassing
 *    the ~4.5 MB function body limit) and sends us the blob URL as JSON.
 *  - Local: a multipart upload, stored on disk.
 * Planning is kicked off separately by the client.
 */
export async function POST(req: Request) {
  let blobUrl: string | null = null;
  try {
    let fileName: string;
    let buf: Buffer;
    if (req.headers.get("content-type")?.includes("application/json")) {
      if (!usesBlob) return Response.json({ error: "Blob uploads are not configured" }, { status: 400 });
      const body = BlobBody.parse(await req.json());
      blobUrl = body.blobUrl;
      fileName = body.fileName;
      buf = await readBlob(blobUrl); // private blobs: only resolves in our own store
    } else {
      const file = (await req.formData()).get("file");
      if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
      fileName = file.name;
      buf = Buffer.from(await file.arrayBuffer());
    }

    const invalid = await validatePdf(buf);
    if (invalid) {
      if (blobUrl) await deleteBlobQuietly(blobUrl);
      return Response.json({ error: invalid.error }, { status: invalid.status });
    }
    await chargeNewLesson(req);

    const now = new Date().toISOString();
    const lesson: Lesson = {
      id: nanoid(12),
      fileName: fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document.pdf",
      pdfUrl: blobUrl,
      phase: "planning",
      plan: null,
      planRevisions: 0,
      allocation: [],
      generation: {},
      questions: [],
      cards: [],
      chat: [],
      report: null,
      events: [],
      createdAt: now,
      updatedAt: now,
    };
    if (!blobUrl) await savePdf(lesson.id, buf);
    await saveLesson(lesson);
    return Response.json({ id: lesson.id }, { status: 201 });
  } catch (err) {
    if (blobUrl) await deleteBlobQuietly(blobUrl);
    if (err instanceof z.ZodError) return Response.json({ error: err.message }, { status: 400 });
    return errorResponse(err);
  }
}

async function validatePdf(buf: Buffer): Promise<{ error: string; status: number } | null> {
  if (buf.length > MAX_PDF_BYTES) return { error: "PDF must be under 20 MB", status: 413 };
  if (buf.subarray(0, 5).toString() !== "%PDF-") return { error: "File is not a PDF", status: 415 };
  const pages = await countPages(buf);
  if (pages === null) return { error: "Couldn't read this PDF. It may be damaged or password-protected.", status: 422 };
  if (pages > MAX_PDF_PAGES) {
    return {
      error: `This PDF has ${pages} pages. Lessons work best from a single chapter or article, so please upload ${MAX_PDF_PAGES} pages or fewer (e.g. export one chapter as its own PDF).`,
      status: 413,
    };
  }
  return null;
}

async function countPages(buf: Buffer): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return null;
  }
}
