import { QuestionEditorView } from "@/components/quiz/QuestionEditorView";

export default async function QuestionCreatePage({
  searchParams,
}: PageProps<"/quiz/bank/new">) {
  const { book } = await searchParams;
  return <QuestionEditorView bookId={typeof book === "string" ? book : undefined} />;
}
