"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, ErrorBanner, Field, Input, FOCUS_RING } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { errorMessage } from "@/lib/api";
import { listDocuments } from "@/lib/documents";
import * as quizApi from "@/lib/quiz";
import type { Document, QuizDifficulty, QuizGenerationJob, QuizQuestionType } from "@/lib/types";
import { QuizToggleField } from "./QuizFields";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 5분

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TYPE_OPTIONS: { value: QuizQuestionType; label: string }[] = [
  { value: "SINGLE_CHOICE", label: "객관식" },
  { value: "TRUE_FALSE", label: "O/X" },
  { value: "SHORT_ANSWER", label: "단답형" },
];

const MIXED_DIFFICULTY = "";
const DIFFICULTY_OPTIONS = [
  { value: MIXED_DIFFICULTY, label: "섞어서 출제" },
  { value: "EASY", label: "쉬움" },
  { value: "MEDIUM", label: "보통" },
  { value: "HARD", label: "어려움" },
];

const NO_BOOK = "";

export function GenerateQuestionsModal({
  open,
  onClose,
  onGenerated,
  projects,
  defaultProjectId,
  fixedBook,
}: {
  open: boolean;
  onClose: () => void;
  /** 생성 작업이 COMPLETED/FAILED로 끝났을 때 한 번 호출된다 — 부모가 목록을 새로고침한다. */
  onGenerated: () => void;
  /** 프로젝트가 둘 이상일 때만 선택 드롭다운을 보여준다. */
  projects: { id: number; name: string }[];
  defaultProjectId: string;
  fixedBook?: { id: number; title: string; project_id: number };
}) {
  const uid = useId();
  const [projectId, setProjectId] = useState(
    fixedBook ? String(fixedBook.project_id) : defaultProjectId,
  );
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docIds, setDocIds] = useState<number[]>([]);
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<QuizQuestionType[]>(TYPE_OPTIONS.map((t) => t.value));
  const [difficulty, setDifficulty] = useState(MIXED_DIFFICULTY);
  const [excludeDuplicates, setExcludeDuplicates] = useState(true);
  const [books, setBooks] = useState<{ id: number; title: string }[]>([]);
  const [bookId, setBookId] = useState(fixedBook ? String(fixedBook.id) : NO_BOOK);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<QuizGenerationJob | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const pollToken = useRef(0);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectId(fixedBook ? String(fixedBook.project_id) : defaultProjectId);
    setDocIds([]);
    setCount(10);
    setTypes(TYPE_OPTIONS.map((t) => t.value));
    setDifficulty(MIXED_DIFFICULTY);
    setExcludeDuplicates(true);
    setBookId(fixedBook ? String(fixedBook.id) : NO_BOOK);
    setStarting(false);
    setError(null);
    setJob(null);
    setTimedOut(false);
    pollToken.current += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    listDocuments(projectId)
      .then((docs) => {
        if (!cancelled) setDocuments(docs);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  useEffect(() => {
    if (!open || fixedBook) return;
    let cancelled = false;
    quizApi
      .listBooks(projectId)
      .then((list) => {
        if (!cancelled) setBooks(list.filter((b) => !b.has_sessions));
      })
      .catch(() => {
        if (!cancelled) setBooks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, fixedBook]);

  function toggleType(t: QuizQuestionType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t]));
  }

  async function poll(jobId: number, token: number) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      if (pollToken.current !== token) return;
      let current: QuizGenerationJob;
      try {
        current = await quizApi.getGenerationJob(jobId);
      } catch {
        continue;
      }
      if (pollToken.current !== token) return;
      setJob(current);
      if (current.status === "COMPLETED" || current.status === "FAILED") {
        onGenerated();
        return;
      }
    }
    if (pollToken.current === token) setTimedOut(true);
  }

  async function handleStart() {
    if (docIds.length === 0 || types.length === 0) return;
    setStarting(true);
    setError(null);
    const token = ++pollToken.current;
    try {
      const started = await quizApi.generateQuestions(projectId, {
        document_ids: docIds,
        count,
        types,
        difficulty: difficulty === MIXED_DIFFICULTY ? null : (difficulty as QuizDifficulty),
        exclude_duplicates: excludeDuplicates,
        quiz_book_id: bookId ? Number(bookId) : null,
      });
      setJob(started);
      void poll(started.id, token);
    } catch (e) {
      setError(errorMessage(e, "생성을 시작하지 못했습니다."));
    } finally {
      setStarting(false);
    }
  }

  const running = job !== null && job.status === "RUNNING";
  const finished = job !== null && job.status !== "RUNNING";
  const pct =
    job && job.requested_count > 0
      ? Math.min(100, Math.round((job.created_count / job.requested_count) * 100))
      : 0;

  return (
    <Modal open={open} onClose={onClose} title="AI로 문제 생성" className="max-w-lg">
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        {!job ? (
          <>
            <p className="text-xs leading-relaxed text-ink-muted">
              고른 문서를 처음부터 끝까지 훑어 골고루 문제를 냅니다.
            </p>

            {!fixedBook && projects.length > 1 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink">프로젝트</p>
                <Dropdown
                  label="프로젝트"
                  value={projectId}
                  onChange={(v) => {
                    setProjectId(v);
                    setBookId(NO_BOOK);
                  }}
                  options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
                />
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-ink">
                대상 문서 {docIds.length > 0 && `· ${docIds.length}개 선택`}
              </p>
              <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-control border border-border p-1.5">
                {documents.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex cursor-pointer items-start gap-2 rounded-control px-1.5 py-1.5 text-sm text-ink hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={docIds.includes(doc.id)}
                      onChange={() =>
                        setDocIds((prev) =>
                          prev.includes(doc.id)
                            ? prev.filter((v) => v !== doc.id)
                            : [...prev, doc.id],
                        )
                      }
                      className={`mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)] ${FOCUS_RING}`}
                    />
                    <span className="min-w-0 break-words">{doc.name}</span>
                  </label>
                ))}
                {documents.length === 0 && (
                  <p className="px-1.5 py-4 text-center text-xs text-ink-muted">
                    이 프로젝트에 등록된 문서가 없습니다.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="문항 수" htmlFor={`${uid}-count`}>
                <Input
                  id={`${uid}-count`}
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                />
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink">난이도</p>
                <Dropdown
                  label="난이도"
                  value={difficulty}
                  onChange={setDifficulty}
                  options={DIFFICULTY_OPTIONS}
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-ink">문항 유형</p>
              <div className="flex flex-wrap gap-1">
                {TYPE_OPTIONS.map((t) => (
                  <label
                    key={t.value}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-1 py-1.5 text-sm text-ink hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={types.includes(t.value)}
                      onChange={() => toggleType(t.value)}
                      className={`h-4 w-4 accent-[var(--color-primary)] ${FOCUS_RING}`}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <QuizToggleField
              label="문제은행에 있는 문제와 중복 피하기"
              checked={excludeDuplicates}
              onChange={setExcludeDuplicates}
            />

            {fixedBook ? (
              <p className="text-xs text-ink-muted">
                생성된 문제는 <span className="font-medium text-ink">{fixedBook.title}</span>에
                자동으로 편입됩니다.
              </p>
            ) : (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink">자동 편입할 문제집</p>
                <Dropdown
                  label="자동 편입할 문제집"
                  value={bookId}
                  onChange={setBookId}
                  options={[
                    { value: NO_BOOK, label: "선택 안 함 — 문제은행에만 저장" },
                    ...books.map((b) => ({ value: String(b.id), label: b.title })),
                  ]}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={onClose}>
                취소
              </Button>
              <Button
                onClick={() => void handleStart()}
                disabled={starting || docIds.length === 0 || types.length === 0}
              >
                {starting ? "시작하는 중…" : "생성 시작"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-control border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {running ? "생성 중…" : job.status === "FAILED" ? "생성 실패" : "생성 완료"}
                </span>
                <span className="text-xs text-ink-muted tnum">
                  {job.created_count} / {job.requested_count}문항
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${running ? Math.max(pct, 4) : pct}%` }}
                />
              </div>
            </div>

            {job.status === "FAILED" && job.error && <ErrorBanner message={job.error} />}
            {job.status === "COMPLETED" && job.error && (
              <p className="rounded-control bg-surface p-3 text-xs leading-relaxed text-ink-muted">
                {job.created_count}개 문제가 생성됐습니다. 요청한 {job.requested_count}개보다
                적게 만들어졌습니다 — {job.error}
              </p>
            )}
            {job.status === "COMPLETED" && !job.error && (
              <p className="text-sm text-ink-muted">
                {job.created_count}개 문제가 문제은행에 추가됐습니다
                {fixedBook ? `. ${fixedBook.title}에도 편입됐습니다.` : "."}
              </p>
            )}
            {timedOut && (
              <ErrorBanner message="진행 상황 조회가 시간 초과되었습니다. 잠시 후 새로고침해 확인해 주세요." />
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {finished && (
                <Button variant="outline" onClick={() => setJob(null)}>
                  새로 생성
                </Button>
              )}
              <Button onClick={onClose}>{running ? "닫기 (백그라운드에서 계속됨)" : "닫기"}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
