// Turns failed responses into messages a learner can act on. Our routes return
// JSON `{ error }`, but platform errors (e.g. Vercel's 413 for oversized
// function bodies) arrive as plain text, so fall back to the status code.

export const MAX_UPLOAD_MB = 20;
/** Vercel's request body cap for functions; only relevant without Blob uploads. */
export const SERVER_UPLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024;

export function describeHttpError(status: number, body: unknown): string {
  const message = (body as { error?: unknown } | null)?.error;
  if (typeof message === "string" && message) return message;
  switch (status) {
    case 401:
      return "Your access has expired. Reload the page and enter the access code again.";
    case 413:
      return "This file is too large for the server to accept. If this keeps happening, the app's file storage may not be set up.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 502:
    case 503:
    case 504:
      return "The server took too long to respond. Please try again.";
    default:
      return status >= 500 ? `Something went wrong on the server (${status}). Please try again.` : `Request failed (${status}).`;
  }
}

/** Checks a file before uploading; returns a message, or null if it's fine to send. */
export function preflightUpload(file: { name: string; type: string; size: number }, blobUploads: boolean): string | null {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return "Please choose a PDF file.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `This PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_MB} MB; try exporting just the chapter you need.`;
  }
  if (!blobUploads && file.size > SERVER_UPLOAD_LIMIT_BYTES && !isLocalhost()) {
    return "Uploads over 4.5 MB need the app's file storage (Vercel Blob), which isn't configured on this deployment. Ask the person who shared the link to connect Blob storage and redeploy.";
  }
  return null;
}

function isLocalhost() {
  return typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
}
