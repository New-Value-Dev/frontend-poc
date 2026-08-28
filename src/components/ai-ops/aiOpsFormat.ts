/** AI 운영 대시보드 화면들이 공유하는 표시 헬퍼. */

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatChartDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${m}/${d}`;
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function formatKrw(n: number | null): string {
  return n == null ? "-" : `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

export function featureLabel(feature: string): string {
  const labels: Record<string, string> = {
    proofread: "맞춤법 검사",
    rag_answer: "RAG 챗봇",
    quiz_generate: "AI 문제 생성",
  };
  return labels[feature] ?? feature;
}
