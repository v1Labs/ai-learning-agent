import { mkdtempSync } from "fs";
import os from "os";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { makeLesson } from "./fixtures";

// Exercises the store's contract with the local file backend. The Redis
// backend implements the same interface (ADR 0019).
let store: typeof import("@/lib/store");
beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "store-test-"));
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.KV_REST_API_URL;
  store = await import("@/lib/store");
});

describe("store", () => {
  it("round-trips a lesson and backfills defaults", async () => {
    await store.saveLesson(makeLesson());
    const lesson = await store.getLesson("test-lesson");
    expect(lesson?.plan?.title).toBe("Test lesson");
    expect(await store.getLesson("missing")).toBeNull();
  });

  it("serialises concurrent read-modify-write cycles on one lesson", async () => {
    await store.saveLesson({ ...makeLesson(), planRevisions: 0 });
    await Promise.all(
      Array.from({ length: 10 }, () =>
        store.withLesson("test-lesson", async (l) => {
          const n = l.planRevisions;
          await new Promise((r) => setTimeout(r, 2)); // widen the race window
          l.planRevisions = n + 1;
          await store.saveLesson(l);
        }),
      ),
    );
    expect((await store.getLesson("test-lesson"))?.planRevisions).toBe(10);
  });

  it("runs a leased job at most once while it's in flight", async () => {
    let runs = 0;
    const job = () => store.runOnce("job", 60_000, async () => {
      runs++;
      await new Promise((r) => setTimeout(r, 10));
    });
    await Promise.all([job(), job(), job()]);
    expect(runs).toBe(1);
    await job(); // lease released afterwards
    expect(runs).toBe(2);
  });

  it("counts within a window", async () => {
    expect(await store.incrementCounter("c", 60)).toBe(1);
    expect(await store.incrementCounter("c", 60)).toBe(2);
  });

  it("rejects ids that could escape the data directory", async () => {
    await expect(store.getLesson("../etc")).rejects.toThrow("Invalid lesson id");
  });
});
