"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import { listProjects } from "@/lib/projects";
import { query as ragQuery } from "@/lib/rag";
import type { CitationRead, Project } from "@/lib/types";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  citations?: CitationRead[];
  isError?: boolean;
};

function citationLocation(c: CitationRead): string | null {
  if (c.page_start == null) return null;
  return c.page_end != null && c.page_end !== c.page_start
    ? `p.${c.page_start}-${c.page_end}`
    : `p.${c.page_start}`;
}

export default function RagSearchPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => {});
  }, []);

  function toggleProject(id: number) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function send() {
    const question = input.trim();
    if (!question || sending) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setSending(true);
    try {
      const res = await ragQuery(question, {
        project_ids: selectedProjectIds.length ? selectedProjectIds : undefined,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.answer, citations: res.citations },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: errorMessage(e, "답변을 가져오지 못했습니다."), isError: true },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto grid h-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      {/* 검색 범위 */}
      <aside className="rounded-xl border border-border bg-canvas p-4">
        <h2 className="text-sm font-semibold text-ink">검색 범위</h2>
        <ul className="mt-3 flex flex-col gap-1">
          {projects.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface">
                <input
                  type="checkbox"
                  checked={selectedProjectIds.includes(p.id)}
                  onChange={() => toggleProject(p.id)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                {p.name}
              </label>
            </li>
          ))}
          {projects.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-ink-muted">프로젝트가 없습니다</li>
          )}
        </ul>
        <p className="mt-4 border-t border-border pt-3 text-xs text-ink-muted">
          Vector 검색 · 범위를 선택 안 하면 전체 프로젝트 대상
        </p>
      </aside>

      {/* 채팅 / 답변 영역 */}
      <section className="flex min-h-0 flex-col rounded-xl border border-border bg-canvas">
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && (
            <p className="pt-8 text-center text-sm text-ink-muted">
              프로젝트 문서에 대해 궁금한 걸 물어보세요.
            </p>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-md rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-white">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="my-5 flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                  AI
                </span>
                <div className="flex-1">
                  <div
                    className={`rounded-2xl rounded-tl-sm border px-4 py-3 text-sm leading-6 ${
                      m.isError
                        ? "border-primary-soft bg-primary-soft/40 text-primary"
                        : "border-border bg-surface text-ink"
                    }`}
                  >
                    {m.text}
                  </div>

                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-semibold text-ink-muted">출처</p>
                      <ul className="flex flex-col gap-2">
                        {m.citations.map((c, ci) => (
                          <li
                            key={ci}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                          >
                            <div>
                              <span className="font-medium text-ink">{c.document_name}</span>
                              {citationLocation(c) && (
                                <span className="ml-2 text-xs text-ink-muted">
                                  {citationLocation(c)}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-primary">
                              {Math.round(c.score * 100)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {sending && (
            <div className="mt-5 flex items-center gap-2 text-sm text-ink-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
              답변을 생성하고 있어요…
            </div>
          )}
        </div>

        {/* 입력창 */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) void send();
              }}
              disabled={sending}
              placeholder="프로젝트 문서에 대해 질문하세요…"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "전송 중…" : "전송"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
