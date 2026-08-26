import { QuizResult } from "@/components/quiz/QuizResult";

export default async function QuizResultPage({
  params,
  searchParams,
}: PageProps<"/quiz/[quizBookId]/result">) {
  const { quizBookId } = await params;
  const { session } = await searchParams;
  return (
    <QuizResult
      quizBookId={quizBookId}
      sessionId={typeof session === "string" ? session : undefined}
    />
  );
}
