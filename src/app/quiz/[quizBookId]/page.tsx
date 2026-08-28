import { QuizBookDetail } from "@/components/quiz/QuizBookDetail";

export default async function QuizBookDetailPage({
  params,
  searchParams,
}: PageProps<"/quiz/[quizBookId]">) {
  const { quizBookId } = await params;
  const { tab } = await searchParams;
  return (
    <QuizBookDetail
      quizBookId={quizBookId}
      initialTab={typeof tab === "string" ? tab : undefined}
    />
  );
}
