import type { QuizAnswerRecord, QuizQuestion } from "@/lib/types";

/** 퀴즈 화면들이 공유하는 표시 헬퍼. API 호출은 `src/lib/quiz.ts`에 있다. */

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatScore(score: number | null | undefined): string {
  return score == null ? "-" : String(Math.round(score));
}

export function timeLimitLabel(minutes: number | null): string {
  return minutes == null ? "시간 제한 없음" : `제한 ${minutes}분`;
}

export function displayAnswer(
  value: string | null | undefined,
  type: string,
  options: string[] | null | undefined,
): string {
  if (!value) return "(무응답)";
  if (type === "SINGLE_CHOICE" && options) {
    return options[Number(value)] ?? value;
  }
  return value;
}

export function displayRecordAnswer(record: QuizAnswerRecord, value: string | null): string {
  return displayAnswer(value, record.options ? "SINGLE_CHOICE" : "SHORT_ANSWER", record.options);
}

export function sourceLabel(
  question: Pick<QuizQuestion, "source_document_id" | "source_location">,
  documentNames: Map<number, string>,
): string | null {
  const name =
    question.source_document_id != null ? documentNames.get(question.source_document_id) : undefined;
  const parts = [name, question.source_location ?? undefined].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
