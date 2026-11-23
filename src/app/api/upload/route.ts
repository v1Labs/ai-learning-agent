import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { errorResponse } from "@/lib/http";
import { MAX_PDF_BYTES } from "@/lib/limits";

/**
 * Issues short-lived tokens for direct browser-to-Blob uploads (ADR 0019).
 * Tokens only allow PDFs up to 20 MB, as private blobs with random names.
 * Access is already gated by the access code (src/proxy.ts); lesson creation
 * re-validates the file and applies the rate limits.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: MAX_PDF_BYTES,
        addRandomSuffix: true,
      }),
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
