import type { ReactNode } from "react";

export function QuizPageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-5xl flex-col gap-6">{children}</div>;
}
