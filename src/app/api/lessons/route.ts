import { nanoid } from "nanoid";
import { PDFDocument } from "pdf-lib";
import { errorResponse } from "@/lib/http";
import { saveLesson, savePdf } from "@/lib/store";
import type { Lesson } from "@/lib/types";

// The PDF is sent to Claude base64-encoded (~1.33x), and requests cap at 32 MB.
const MAX_PDF_BYTES = 20 * 1024 * 1024;
// Claude accepts up to 600 pages, but a lesson works best from a chapter-sized
// document: planning stays fast and per-lesson cost stays predictable (ADR 0005).
const MAX_PDF_PAGES = Number(process.env.MAX_PDF_PAGES ?? 100);

/** Upload a PDF and create a lesson. Planning is kicked off separately by the client. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
    if (file.size > MAX_PDF_BYTES) return Response.json({ error: "PDF must be under 20 MB" }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.subarray(0, 5).toString() !== "%PDF-") {
      return Response.json({ error: "File is not a PDF" }, { status: 415 });
    }
    const pages = await countPages(buf);
    if (pages === null) {
      return Response.json({ error: "Couldn't read this PDF. It may be damaged or password-protected." }, { status: 422 });
    }
    if (pages > MAX_PDF_PAGES) {
      return Response.json(
        {
          error: `This PDF has ${pages} pages. Lessons work best from a single chapter or article, so please upload ${MAX_PDF_PAGES} pages or fewer (e.g. export one chapter as its own PDF).`,
        },
        { status: 413 },
      );
    }

    const now = new Date().toISOString();
    const lesson: Lesson = {
      id: nanoid(12),
      fileName: file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document.pdf",
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
    await savePdf(lesson.id, buf);
    await saveLesson(lesson);
    return Response.json({ id: lesson.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

async function countPages(buf: Buffer): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return null;
  }
}
