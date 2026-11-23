import "server-only";
import { Redis } from "@upstash/redis";
import { del as deleteBlob, get as getBlob } from "@vercel/blob";
import { promises as fs } from "fs";
import { nanoid } from "nanoid";
import path from "path";
import type { Lesson } from "./types";

// Persistence behind one small interface (ADR 0019):
//  - Local dev (no env): JSON files + PDFs in .data/, in-process locks.
//  - Deployed (Upstash Redis + Vercel Blob env vars): lessons in Redis, PDFs in
//    private Blob storage, and locks/leases as Redis keys so they hold across
//    serverless instances.

export class NotFoundError extends Error {}

/** Where a lesson's PDF lives: the local data dir (by id) or a private Blob URL. */
export type PdfRef = Pick<Lesson, "id" | "pdfUrl">;

interface Backend {
  read(id: string): Promise<Lesson | null>;
  write(lesson: Lesson): Promise<void>;
  /** Waits for an exclusive lock; returns a release function. */
  lock(key: string, ttlMs: number): Promise<() => Promise<void>>;
  /** Non-blocking: true if acquired. Used to run background jobs at most once. */
  lease(key: string, ttlMs: number): Promise<boolean>;
  unlease(key: string): Promise<void>;
  /** Increments a counter that expires after `ttlSec`; returns the new value. */
  incr(key: string, ttlSec: number): Promise<number>;
}

// ---------------- File backend (local development) ----------------

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".data", "lessons");

function lessonDir(id: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid lesson id");
  return path.join(DATA_DIR, id);
}

function fileBackend(): Backend {
  const locks = new Map<string, Promise<unknown>>();
  const leases = new Set<string>();
  const counters = new Map<string, { n: number; expires: number }>();
  return {
    async read(id) {
      try {
        return JSON.parse(await fs.readFile(path.join(lessonDir(id), "lesson.json"), "utf8")) as Lesson;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async write(lesson) {
      const dir = lessonDir(lesson.id);
      await fs.mkdir(dir, { recursive: true });
      const tmp = path.join(dir, "lesson.json.tmp");
      await fs.writeFile(tmp, JSON.stringify(lesson, null, 2));
      await fs.rename(tmp, path.join(dir, "lesson.json")); // atomic replace
    },
    async lock(key) {
      const prev = locks.get(key) ?? Promise.resolve();
      let release!: () => void;
      const chained = prev.then(() => new Promise<void>((r) => (release = r)));
      locks.set(key, chained);
      await prev;
      return async () => {
        release();
        if (locks.get(key) === chained) locks.delete(key);
      };
    },
    async lease(key) {
      if (leases.has(key)) return false;
      leases.add(key);
      return true;
    },
    async unlease(key) {
      leases.delete(key);
    },
    async incr(key, ttlSec) {
      const now = Date.now();
      const c = counters.get(key);
      const next = c && c.expires > now ? { n: c.n + 1, expires: c.expires } : { n: 1, expires: now + ttlSec * 1000 };
      counters.set(key, next);
      return next.n;
    },
  };
}

// ---------------- Redis backend (deployed) ----------------

const LESSON_TTL_SEC = 30 * 24 * 3600; // demo hygiene: lessons expire after 30 days idle
const RELEASE_IF_OWNER = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

function redisBackend(redis: Redis): Backend {
  return {
    async read(id) {
      return (await redis.get<Lesson>(`lesson:${id}`)) ?? null;
    },
    async write(lesson) {
      await redis.set(`lesson:${lesson.id}`, lesson, { ex: LESSON_TTL_SEC });
    },
    async lock(key, ttlMs) {
      const token = nanoid();
      const deadline = Date.now() + ttlMs;
      for (let wait = 25; ; wait = Math.min(wait * 2, 500)) {
        if (await redis.set(`lock:${key}`, token, { nx: true, px: ttlMs })) break;
        if (Date.now() > deadline) throw new Error(`Timed out waiting for lock ${key}`);
        await new Promise((r) => setTimeout(r, wait));
      }
      return async () => {
        await redis.eval(RELEASE_IF_OWNER, [`lock:${key}`], [token]);
      };
    },
    async lease(key, ttlMs) {
      return (await redis.set(`lease:${key}`, "1", { nx: true, px: ttlMs })) === "OK";
    },
    async unlease(key) {
      await redis.del(`lease:${key}`);
    },
    async incr(key, ttlSec) {
      const n = await redis.incr(`count:${key}`);
      if (n === 1) await redis.expire(`count:${key}`, ttlSec);
      return n;
    },
  };
}

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
export const storageBackend: "redis" | "file" = hasRedis ? "redis" : "file";
/**
 * How Vercel Blob is authenticated, if at all. Older stores provide a
 * read-write token; newer ones use Vercel OIDC (BLOB_STORE_ID + a runtime OIDC
 * token, which the SDK picks up automatically). Browser uploads differ between
 * the two (client tokens vs presigned URLs), reads and deletes don't.
 */
export const blobMode: "token" | "oidc" | null = process.env.BLOB_READ_WRITE_TOKEN
  ? "token"
  : process.env.BLOB_STORE_ID
    ? "oidc"
    : null;
/** True when PDFs should go to Vercel Blob (uploaded directly from the browser). */
export const usesBlob = blobMode !== null;
const backend: Backend = hasRedis ? redisBackend(Redis.fromEnv()) : fileBackend();

// ---------------- Public API ----------------

export async function saveLesson(lesson: Lesson): Promise<Lesson> {
  lesson.updatedAt = new Date().toISOString();
  await backend.write(lesson);
  return lesson;
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const lesson = await backend.read(id);
  return lesson ? withDefaults(lesson) : null;
}

/**
 * Read-modify-write under a per-lesson lock, so concurrent requests (e.g. a
 * double-clicked submit, or background jobs on other instances) can't
 * interleave. The lock outlives the slowest step that holds it (plan drafting).
 */
export async function withLesson<T>(id: string, fn: (lesson: Lesson) => Promise<T>): Promise<T> {
  const release = await backend.lock(`lesson:${id}`, 180_000);
  try {
    const lesson = await getLesson(id);
    if (!lesson) throw new NotFoundError(`Lesson ${id} not found`);
    return await fn(lesson);
  } finally {
    await release();
  }
}

/** Runs `fn` unless another invocation (on any instance) holds the lease. */
export async function runOnce(key: string, ttlMs: number, fn: () => Promise<void>) {
  if (!(await backend.lease(key, ttlMs))) return;
  try {
    await fn();
  } finally {
    await backend.unlease(key);
  }
}

export const incrementCounter = (key: string, ttlSec: number) => backend.incr(key, ttlSec);

// ---------------- PDFs ----------------

/** Local mode only: write the uploaded PDF next to the lesson. */
export async function savePdf(id: string, data: Buffer) {
  const dir = lessonDir(id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "source.pdf"), data);
}

/** Reads a private Blob into memory (uploads are capped at 20 MB). */
export async function readBlob(url: string): Promise<Buffer> {
  const res = await getBlob(url, { access: "private" });
  if (!res || res.statusCode !== 200) throw new NotFoundError("Uploaded PDF not found");
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

export const deleteBlobQuietly = (url: string) => deleteBlob(url).catch(() => {});

// Small per-instance cache: every model call in a lesson re-sends the PDF.
const pdfCache = new Map<string, string>();

export async function getPdfBase64(ref: PdfRef): Promise<string> {
  const key = ref.pdfUrl ?? ref.id;
  const cached = pdfCache.get(key);
  if (cached) return cached;
  const buf = ref.pdfUrl ? await readBlob(ref.pdfUrl) : await fs.readFile(path.join(lessonDir(ref.id), "source.pdf"));
  const b64 = buf.toString("base64");
  if (pdfCache.size >= 4) pdfCache.delete(pdfCache.keys().next().value!);
  pdfCache.set(key, b64);
  return b64;
}

/** Backfills fields added after a lesson was first written. */
function withDefaults(lesson: Lesson): Lesson {
  lesson.allocation ??= [];
  lesson.generation ??= {};
  lesson.cards ??= [];
  lesson.events ??= [];
  lesson.pdfUrl ??= null;
  return lesson;
}
