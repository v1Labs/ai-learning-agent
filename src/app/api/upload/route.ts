import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { connection } from "next/server";
import { errorResponse } from "@/lib/http";
import { MAX_PDF_BYTES } from "@/lib/limits";
import { blobMode } from "@/lib/store";

const PDF_ONLY = { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_PDF_BYTES };

/** Tells the client, at upload time, whether and how to upload straight to Blob. */
export async function GET() {
  await connection(); // evaluate per request, never at build time
  return Response.json({ blobUploads: blobMode !== null, blobMode }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Authorises direct browser-to-Blob uploads (ADR 0019): PDFs only, up to
 * 20 MB, private, with random names, valid for 10 minutes. Supports both
 * Blob credential styles:
 *  - read-write token stores: a client token (`handleUpload`)
 *  - OIDC stores: a presigned upload URL (`handleUploadPresigned`)
 * Access is already gated by the access code (src/proxy.ts); lesson creation
 * re-validates the file and applies the rate limits.
 */
export async function POST(req: Request) {
  try {
    if (blobMode === "token") {
      const result = await handleUpload({
        body: (await req.json()) as HandleUploadBody,
        request: req,
        onBeforeGenerateToken: async () => ({
          ...PDF_ONLY,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
        }),
      });
      return Response.json(result);
    }
    if (blobMode === "oidc") {
      const result = await handleUploadPresigned({
        body: (await req.json()) as HandleUploadPresignedBody,
        request: req,
        getSignedToken: async (pathname) => ({
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            ...PDF_ONLY,
            validUntil: Date.now() + 10 * 60_000,
          }),
          urlOptions: { ...PDF_ONLY, addRandomSuffix: true },
        }),
      });
      return Response.json(result);
    }
    return Response.json({ error: "File storage (Vercel Blob) is not configured" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
