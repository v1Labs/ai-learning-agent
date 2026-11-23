export function QuestionProgress({ answered, total }: { answered: number; total: number }) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-zinc-500">
        {answered}/{total} questions
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < answered ? "bg-emerald-500" : i === answered ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
