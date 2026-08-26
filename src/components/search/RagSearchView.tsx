"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listProjects } from "@/lib/projects";
import {
  listConversations,
  getConversation,
  queryStream,
  renameConversation,
  deleteConversation,
} from "@/lib/rag";
import { errorMessage, isAuthError, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { ConfidenceBadge, ErrorBanner, FOCUS_RING } from "@/components/ui/primitives";
import { ConfirmDialog, PromptDialog } from "@/components/ui/Modal";
import { IconMenu } from "@/components/ui/IconMenu";
import { relativeTime } from "@/components/activity/ActivityFeed";
import type { Project, RagCitation, RagConversationSummary } from "@/lib/types";

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: RagCitation[];
  streaming?: boolean;
  confidence?: number | null;
  error?: string;
  errorCode?: string;
  retryQuestion?: string;
};

export function RagSearchView() {
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(
    new Set(),
  );
  const [conversations, setConversations] = useState<RagConversationSummary[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);

  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const [renameTarget, setRenameTarget] = useState<RagConversationSummary | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RagConversationSummary | null>(null);
  const [deleteConvBusy, setDeleteConvBusy] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    Promise.all([listProjects(), listConversations()])
      .then(([p, c]) => {
        if (cancelled) return;
        setProjects(p);
        setConversations(c);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "검색 범위를 불러오지 못했습니다."));
        setNeedLogin(isAuthError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function toggleProject(id: number) {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startNewConversation() {
    abortRef.current?.abort();
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }

  async function submitRename(title: string) {
    if (!renameTarget) return;
    setRenameBusy(true);
    try {
      const updated = await renameConversation(renameTarget.id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setRenameTarget(null);
    } catch (e) {
      setError(errorMessage(e, "대화 제목 변경에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setRenameBusy(false);
    }
  }

  async function confirmDeleteConversation() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteConvBusy(true);
    try {
      await deleteConversation(id);
      if (activeConversationId === id) startNewConversation();
      setConversations(await listConversations());
      setDeleteTarget(null);
    } catch (e) {
      setError(errorMessage(e, "대화 삭제에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setDeleteConvBusy(false);
    }
  }

  const openConversation = useCallback(async (id: number) => {
    abortRef.current?.abort();
    setLoadingConversation(true);
    setError(null);
    try {
      const detail = await getConversation(id);
      setActiveConversationId(detail.id);
      setSelectedProjectIds(new Set(detail.scope?.project_ids ?? []));
      setMessages(
        detail.messages.map((m) => ({
          role: m.role,
          content: m.content,
          citations: m.citations ?? undefined,
          confidence: m.confidence,
        })),
      );
    } catch (e) {
      setError(errorMessage(e, "대화를 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  async function send() {
    const q = question.trim();
    if (!q || sending) return;

    setQuestion("");
    setError(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
      { role: "assistant", content: "", streaming: true },
    ]);
    await runQuery(q);
  }

  async function retry(q: string) {
    if (sending) return;
    setError(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true },
    ]);
    await runQuery(q);
  }

  async function runQuery(q: string) {
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    function updateLastAssistant(patch: Partial<LocalMessage>) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant")
          next[next.length - 1] = { ...last, ...patch };
        return next;
      });
    }

    try {
      await queryStream(
        {
          question: q,
          scope: selectedProjectIds.size
            ? { project_ids: [...selectedProjectIds] }
            : undefined,
          conversation_id: activeConversationId ?? undefined,
          top_k: 5,
        },
        {
          onMeta: (meta) => {
            setActiveConversationId((prev) => prev ?? meta.conversation_id);
          },
          onDelta: (text) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + text,
                };
              }
              return next;
            });
          },
          onCitations: (citations) => updateLastAssistant({ citations }),
          onDone: (done) => {
            setActiveConversationId(done.conversation_id);
            updateLastAssistant({ streaming: false, confidence: done.confidence });
            listConversations()
              .then(setConversations)
              .catch(() => {});
          },
          onError: (code, detail) => {
            updateLastAssistant({
              streaming: false,
              error: detail,
              errorCode: code,
              retryQuestion: q,
            });
          },
        },
        controller.signal,
      );
    } catch (e) {
      if (e instanceof ApiError) {
        updateLastAssistant({ streaming: false, error: e.message });
        setNeedLogin(isAuthError(e));
      } else if (!(e instanceof DOMException && e.name === "AbortError")) {
        updateLastAssistant({
          streaming: false,
          error: "답변을 받아오지 못했습니다.",
        });
      }
    } finally {
      setSending(false);
    }
  }

  if (!authLoading && !user) {
    return <ErrorBanner message="로그인이 필요합니다." needLogin />;
  }

  return (
    <div className="mx-auto grid h-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      {/* 검색 범위 + 대화 목록 */}
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-canvas p-4">
        <h2 className="text-sm font-semibold text-ink">검색 범위</h2>
        <ul className="mt-3 flex flex-col gap-1">
          <li>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface">
              <input
                type="checkbox"
                checked={selectedProjectIds.size === 0}
                onChange={() => setSelectedProjectIds(new Set())}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              전체 프로젝트
            </label>
          </li>
          {projects.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface">
                <input
                  type="checkbox"
                  checked={selectedProjectIds.has(p.id)}
                  onChange={() => toggleProject(p.id)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="truncate">{p.name}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <h2 className="text-sm font-semibold text-ink">대화</h2>
          <button
            type="button"
            onClick={startNewConversation}
            className={`text-xs font-medium text-primary hover:underline ${FOCUS_RING} rounded-sm`}
          >
            + 새 대화
          </button>
        </div>
        <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {conversations.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-ink-muted">
              아직 대화가 없습니다.
            </li>
          )}
          {conversations.map((c) => (
            <li key={c.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => openConversation(c.id)}
                className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${FOCUS_RING} ${
                  c.id === activeConversationId
                    ? "bg-primary-soft text-primary"
                    : "text-ink hover:bg-surface"
                }`}
              >
                <span className="block truncate">
                  {c.title || "제목 없는 대화"}
                </span>
                <span className="block text-xs text-ink-muted">
                  {relativeTime(c.updated_at)}
                </span>
              </button>
              <IconMenu
                ariaLabel={`${c.title || "제목 없는 대화"} 메뉴`}
                variant="plain"
                items={[
                  {
                    key: "rename",
                    label: "제목 수정",
                    onSelect: () => setRenameTarget(c),
                  },
                  {
                    key: "delete",
                    label: "삭제",
                    tone: "danger",
                    onSelect: () => setDeleteTarget(c),
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      </aside>

      {/* 채팅 / 답변 영역 */}
      <section className="flex min-h-0 flex-col rounded-xl border border-border bg-canvas">
        {error && (
          <div className="p-3">
            <ErrorBanner message={error} needLogin={needLogin} />
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
          {loadingConversation ? (
            <p className="text-sm text-ink-muted">대화를 불러오는 중…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink-muted">
              프로젝트 문서에 대해 무엇이든 물어보세요. 근거가 있는 답변만
              인용과 함께 드립니다.
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-md rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-white">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                      AI
                    </span>
                    <div className="flex-1">
                      <div className="markdown-content rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3 text-sm leading-6 text-ink">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto">
                                <table>{children}</table>
                              </div>
                            ),
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                        {m.streaming && (
                          <span className="ml-0.5 inline-block animate-pulse">
                            ▍
                          </span>
                        )}
                        {m.error && (
                          <span className="block text-primary">{m.error}</span>
                        )}
                        {m.errorCode === "llm_call_failed" &&
                          m.retryQuestion && (
                            <button
                              type="button"
                              onClick={() => retry(m.retryQuestion!)}
                              disabled={sending}
                              className={`mt-2 rounded-lg border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                            >
                              다시 시도
                            </button>
                          )}
                      </div>

                      {!m.streaming &&
                        (m.confidence != null || !!m.citations?.length) && (
                        <div className="mt-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            {!!m.citations?.length ? (
                              <p className="text-xs font-semibold text-ink-muted">
                                출처
                              </p>
                            ) : (
                              <span />
                            )}
                            {m.confidence != null && (
                              <ConfidenceBadge value={m.confidence} />
                            )}
                          </div>
                          {!!m.citations?.length && (
                            <ul className="flex flex-col gap-2">
                            {m.citations.map((c) => (
                              <li key={`${c.chunk_id}-${c.index}`}>
                                <Link
                                  href={`/documents/${c.document_id}${c.section_id ? `?section=${c.section_id}` : ""}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary hover:bg-primary-soft ${FOCUS_RING}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <span className="font-medium text-ink">
                                        {c.document_name}
                                      </span>
                                      {(c.heading_path.length > 0 ||
                                        c.page_start) && (
                                        <span className="ml-2 truncate text-xs text-ink-muted">
                                          {c.heading_path.join(" · ")}
                                          {c.page_start &&
                                            ` (p.${c.page_start}${c.page_end && c.page_end !== c.page_start ? `-${c.page_end}` : ""})`}
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      title="검색 융합 순위 기반 표시 순서 — 절대 관련도 수치가 아니라 답변끼리는 비교할 수 없다"
                                      className="shrink-0 text-xs font-medium text-primary"
                                    >
                                      [{c.index}]
                                    </span>
                                  </div>
                                </Link>
                              </li>
                            ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* 입력창 */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
              }}
              placeholder="프로젝트 문서에 대해 질문하세요…"
              disabled={sending}
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !question.trim()}
              className={`rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              전송
            </button>
          </div>
        </div>
      </section>

      <PromptDialog
        open={renameTarget !== null}
        title="대화 제목 수정"
        fieldLabel="제목"
        placeholder="대화 제목"
        initialValue={renameTarget?.title ?? ""}
        submitLabel="저장"
        onSubmit={submitRename}
        onCancel={() => setRenameTarget(null)}
        busy={renameBusy}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="대화 삭제"
        message={`"${deleteTarget?.title || "제목 없는 대화"}" 대화를 삭제할까요? 되돌릴 수 없습니다.`}
        onConfirm={confirmDeleteConversation}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteConvBusy}
      />
    </div>
  );
}
