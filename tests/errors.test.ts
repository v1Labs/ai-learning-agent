import { describe, expect, it } from "vitest";
import { describeHttpError, preflightUpload } from "@/lib/errors";

const MB = 1024 * 1024;
const pdf = (size: number) => ({ name: "chapter.pdf", type: "application/pdf", size });

describe("describeHttpError", () => {
  it("prefers the server's own message", () => {
    expect(describeHttpError(413, { error: "This PDF has 767 pages." })).toBe("This PDF has 767 pages.");
  });

  it("explains platform errors that arrive without JSON (e.g. Vercel's 413)", () => {
    expect(describeHttpError(413, null)).toMatch(/too large/);
    expect(describeHttpError(401, null)).toMatch(/access code/);
    expect(describeHttpError(504, null)).toMatch(/took too long/);
    expect(describeHttpError(500, null)).toMatch(/server \(500\)/);
  });
});

describe("preflightUpload", () => {
  it("rejects non-PDFs and files over 20 MB before uploading", () => {
    expect(preflightUpload({ name: "notes.txt", type: "text/plain", size: 10 }, true)).toMatch(/PDF/);
    expect(preflightUpload(pdf(25 * MB), true)).toMatch(/25\.0 MB/);
  });

  it("allows up to 20 MB when uploads go straight to Blob storage", () => {
    expect(preflightUpload(pdf(14 * MB), true)).toBeNull();
  });

  it("names the missing storage when a deployment can only take small uploads", () => {
    // Tests run without `window`, i.e. not on localhost.
    expect(preflightUpload(pdf(6 * MB), false)).toMatch(/Vercel Blob/);
    expect(preflightUpload(pdf(2 * MB), false)).toBeNull();
  });
});
