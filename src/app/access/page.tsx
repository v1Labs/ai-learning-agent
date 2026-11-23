import { Suspense } from "react";
import { AccessForm } from "@/components/AccessForm";

export default function AccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">AI Learning Agent</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Enter the access code</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">This demo is shared privately. Use the code you were given.</p>
      <Suspense>
        <AccessForm />
      </Suspense>
    </main>
  );
}
