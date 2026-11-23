import { UploadForm } from "@/components/UploadForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">AI Learning Agent</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Turn any PDF into an interactive lesson</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Upload a document. The agent drafts a learning path for you to approve, quizzes you objective by objective, and
        finishes with a progress report and study tips.
      </p>
      <div className="mt-10">
        <UploadForm blobUploads={!!process.env.BLOB_READ_WRITE_TOKEN} />
      </div>
    </main>
  );
}
