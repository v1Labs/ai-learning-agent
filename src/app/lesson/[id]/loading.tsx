import { Spinner } from "@/components/Spinner";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <Spinner label="Loading your lesson…" />
    </div>
  );
}
