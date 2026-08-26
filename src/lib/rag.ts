import { api, ApiError, BASE_URL, getAccessToken } from "./api";
import type {
  RagConversationDetail,
  RagConversationSummary,
  RagHistoryItem,
  RagQueryRequest,
  RagQueryResponse,
  RagScope,
  RagSearchResponse,
  RagStreamDone,
  RagStreamMeta,
  RagCitation,
} from "./types";

/** `POST /rag/search`(검색 품질 확인용). */
export function search(
  question: string,
  opts?: { scope?: RagScope; top_k?: number; min_score?: number },
) {
  return api.post<RagSearchResponse>("/rag/search", { question, ...opts });
}

/** `POST /rag/query` 검색 + GPT 답변 (동기) */
export function query(body: RagQueryRequest) {
  return api.post<RagQueryResponse>("/rag/query", body);
}

/** `GET /rag/history?limit=` 최근 질문*/
export function history(limit = 10) {
  return api.get<RagHistoryItem[]>(`/rag/history?limit=${limit}`);
}

/** `GET /rag/conversations?limit=` 내 대화 목록 */
export function listConversations(limit = 20) {
  return api.get<RagConversationSummary[]>(`/rag/conversations?limit=${limit}`);
}

/** `GET /rag/conversations/{id}` 대화 상세 */
export function getConversation(conversationId: number) {
  return api.get<RagConversationDetail>(`/rag/conversations/${conversationId}`);
}

/** `PATCH /rag/conversations/{id}` 대화 제목 수정 (본인 대화만) */
export function renameConversation(conversationId: number, title: string) {
  return api.patch<RagConversationSummary>(`/rag/conversations/${conversationId}`, {
    title,
  });
}

/** `DELETE /rag/conversations/{id}` 대화 삭제 (메시지 포함) */
export function deleteConversation(conversationId: number) {
  return api.delete<void>(`/rag/conversations/${conversationId}`);
}

export type RagStreamHandlers = {
  onMeta?: (meta: RagStreamMeta) => void;
  onDelta?: (text: string) => void;
  onCitations?: (citations: RagCitation[]) => void;
  onDone?: (done: RagStreamDone) => void;
  onError?: (code: string, detail: string) => void;
};

/**
 * `POST /rag/query/stream` — 검색 + GPT 답변 (SSE)
 */
export async function queryStream(
  body: RagQueryRequest,
  handlers: RagStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}/rag/query/stream`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = (await res.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      /* JSON이 아닌 에러 응답 */
    }
    throw new ApiError(res.status, detail);
  }
  if (!res.body) throw new ApiError(500, "스트림 응답을 열 수 없습니다.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      if (!frame.trim()) continue;

      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;

      const parsed = JSON.parse(data);
      switch (event) {
        case "meta":
          handlers.onMeta?.(parsed);
          break;
        case "delta":
          handlers.onDelta?.(parsed.text);
          break;
        case "citations":
          handlers.onCitations?.(parsed.citations);
          break;
        case "done":
          handlers.onDone?.(parsed);
          break;
        case "error":
          handlers.onError?.(parsed.code, parsed.detail);
          break;
      }
    }
  }
}
