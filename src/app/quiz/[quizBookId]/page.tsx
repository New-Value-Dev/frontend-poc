import { QuizBookDetail } from "@/components/quiz/QuizBookDetail";

export default async function QuizBookDetailPage({ params }: PageProps<"/quiz/[quizBookId]">) {
  const { quizBookId } = await params;
  return <QuizBookDetail quizBookId={quizBookId} />;
}
