import { QuizTake } from "@/components/quiz/QuizTake";

export default async function QuizTakePage({ params }: PageProps<"/quiz/[quizBookId]/take">) {
  const { quizBookId } = await params;
  return <QuizTake quizBookId={quizBookId} />;
}
