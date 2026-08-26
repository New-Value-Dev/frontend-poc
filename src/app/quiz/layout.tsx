import { QuizProjectProvider } from "@/components/quiz/QuizProjectProvider";

/** 퀴즈 하위 메뉴 4개가 "지금 보고 있는 프로젝트"를 공유하도록 감싼다. */
export default function QuizLayout({ children }: LayoutProps<"/quiz">) {
  return <QuizProjectProvider>{children}</QuizProjectProvider>;
}
