import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Lesson } from "./types";

// Simple file-backed persistence: one JSON document + the source PDF per lesson.
// Swap this module for Postgres/Redis/etc. without touching callers.
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".data", "lessons");

function lessonPath(id: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid lesson id");
  return path.join(DATA_DIR, id);
}

export async function saveLesson(lesson: Lesson): Promise<Lesson> {
  const dir = lessonPath(lesson.id);
  await fs.mkdir(dir, { recursive: true });
  lesson.updatedAt = new Date().toISOString();
  const tmp = path.join(dir, "lesson.json.tmp");
  await fs.writeFile(tmp, JSON.stringify(lesson, null, 2));
  await fs.rename(tmp, path.join(dir, "lesson.json")); // atomic replace
  return lesson;
}

export async function getLesson(id: string): Promise<Lesson | null> {
  try {
    const raw = await fs.readFile(path.join(lessonPath(id), "lesson.json"), "utf8");
    return JSON.parse(raw) as Lesson;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function savePdf(id: string, data: Buffer) {
  const dir = lessonPath(id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "source.pdf"), data);
}

export async function getPdfBase64(id: string): Promise<string> {
  const buf = await fs.readFile(path.join(lessonPath(id), "source.pdf"));
  return buf.toString("base64");
}

// Per-lesson mutex so concurrent requests (e.g. double-clicked submit) can't
// interleave read-modify-write cycles. Fine for a single Node process.
const locks = new Map<string, Promise<unknown>>();

export async function withLesson<T>(id: string, fn: (lesson: Lesson) => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((r) => (release = r));
  const chained = prev.then(() => current);
  locks.set(id, chained);
  await prev;
  try {
    const lesson = await getLesson(id);
    if (!lesson) throw new NotFoundError(`Lesson ${id} not found`);
    return await fn(lesson);
  } finally {
    release();
    if (locks.get(id) === chained) locks.delete(id);
  }
}

export class NotFoundError extends Error {}
