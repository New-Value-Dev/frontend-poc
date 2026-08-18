import { api } from "./api";
import type { RagAnswer, RagScope } from "./types";

export function query(question: string, scope?: RagScope) {
  return api.post<RagAnswer>("/rag/query", { question, scope: scope ?? {} });
}

export type RagHistoryItem = { id: string; question: string; at: string };

export function history(limit = 10) {
  return api.get<RagHistoryItem[]>(`/rag/history?limit=${limit}`);
}
