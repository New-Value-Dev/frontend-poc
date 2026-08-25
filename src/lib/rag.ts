import { api } from "./api";
import type { RagAnswer, RagHistoryItem, RagScope } from "./types";

export function query(question: string, scope?: RagScope) {
  return api.post<RagAnswer>("/rag/query", { question, scope: scope ?? {} });
}

export function history(limit = 10) {
  return api.get<RagHistoryItem[]>(`/rag/history?limit=${limit}`);
}
