import { notFound } from "next/navigation";
import { LessonView } from "@/components/LessonView";
import { toPublicLesson } from "@/lib/lesson";
import { getLesson } from "@/lib/store";

export default async function LessonPage({ params }: PageProps<"/lesson/[id]">) {
  const { id } = await params;
  const lesson = await getLesson(id).catch(() => null);
  if (!lesson) notFound();
  return <LessonView initial={toPublicLesson(lesson)} />;
}
