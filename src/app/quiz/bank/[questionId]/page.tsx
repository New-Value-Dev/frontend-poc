import { QuestionEditorView } from "@/components/quiz/QuestionEditorView";

export default async function QuestionEditPage({
  params,
  searchParams,
}: PageProps<"/quiz/bank/[questionId]">) {
  const { questionId } = await params;
  const { book } = await searchParams;
  return (
    <QuestionEditorView
      questionId={questionId}
      bookId={typeof book === "string" ? book : undefined}
    />
  );
}
