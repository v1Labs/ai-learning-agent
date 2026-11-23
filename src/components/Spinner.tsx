export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-5 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
      <span>{label}</span>
    </div>
  );
}
