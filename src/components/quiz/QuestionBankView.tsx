"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Card,
  Button,
  buttonClass,
  ErrorBanner,
  QuestionTypeBadge,
  DifficultyBadge,
  ReviewStatusBadge,
  FOCUS_RING,
} from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { IconMenu } from "@/components/ui/IconMenu";
import { Dropdown } from "@/components/ui/Dropdown";
import { FilterBar } from "@/components/ui/FilterBar";
import { errorMessage, isAuthError } from "@/lib/api";
import { listDocuments } from "@/lib/documents";
import * as quizApi from "@/lib/quiz";
import type {
  Document,
  QuizBook,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionType,
  QuizReviewStatus,
} from "@/lib/types";
import {
  ALL_PROJECTS,
  QuizProjectFilter,
  QuizProjectGate,
  useProjectFilterActive,
  useQuizProject,
} from "./QuizProjectProvider";
import { QuizPageShell } from "./QuizPageShell";
import { GenerateQuestionsModal } from "./GenerateQuestionsModal";
import { sourceLabel } from "./quizFormat";

const ALL = "all";

const DIFFICULTY_OPTIONS = [
  { value: ALL, label: "전체 난이도" },
  { value: "EASY", label: "쉬움" },
  { value: "MEDIUM", label: "보통" },
  { value: "HARD", label: "어려움" },
];

const TYPE_OPTIONS = [
  { value: ALL, label: "전체 유형" },
  { value: "SINGLE_CHOICE", label: "객관식" },
  { value: "TRUE_FALSE", label: "O/X" },
  { value: "SHORT_ANSWER", label: "단답형" },
];

const REVIEW_OPTIONS = [
  { value: ALL, label: "전체 검수 상태" },
  { value: "DRAFT", label: "검수 전" },
  { value: "REVIEWED", label: "검수 중" },
  { value: "APPROVED", label: "검수 완료" },
];

export function QuestionBankView() {
  return (
    <QuizPageShell>
      <QuizProjectGate>
        <Bank />
      </QuizProjectGate>
    </QuizPageShell>
  );
}

function Bank() {
  const router = useRouter();
  const { projects, scopeIds, projectId, setProjectId, projectNames } = useQuizProject();
  const projectFilterActive = useProjectFilterActive();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  /* 필터는 서버 쿼리 파라미터로 넘긴다 (`?document_id=&difficulty=&type=&review_status=&q=`). */
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [docFilter, setDocFilter] = useState(ALL);
  const [difficultyFilter, setDifficultyFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [reviewFilter, setReviewFilter] = useState(ALL);

  const [selected, setSelected] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<QuizQuestion | null>(null);
  const [showAddToBook, setShowAddToBook] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        document_id: docFilter === ALL ? undefined : Number(docFilter),
        difficulty: difficultyFilter === ALL ? undefined : (difficultyFilter as QuizDifficulty),
        type: typeFilter === ALL ? undefined : (typeFilter as QuizQuestionType),
        review_status: reviewFilter === ALL ? undefined : (reviewFilter as QuizReviewStatus),
        q: debouncedQuery || undefined,
      };
      const lists = await Promise.all(scopeIds.map((pid) => quizApi.listQuestions(pid, filters)));
      setQuestions(
        lists
          .flat()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      );
    } catch (e) {
      setError(errorMessage(e, "문제은행을 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setLoading(false);
    }
  }, [scopeIds, docFilter, difficultyFilter, typeFilter, reviewFilter, debouncedQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(scopeIds.map((pid) => listDocuments(String(pid)).catch(() => [])))
      .then((lists) => {
        if (!cancelled) setDocuments(lists.flat());
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeIds]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected([]);
    setDocFilter(ALL);
  }, [scopeIds]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await quizApi.deleteQuestion(deleteTarget.id);
      setSelected((prev) => prev.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(errorMessage(e, "문제를 삭제하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }

  const documentNames = new Map(documents.map((d) => [d.id, d.name]));
  const showProjectName = projectId === ALL_PROJECTS;

  const documentOptions = useMemo(
    () => [
      { value: ALL, label: "전체 문서" },
      ...documents.map((d) => ({
        value: String(d.id),
        label: d.name,
        hint: showProjectName ? projectNames.get(d.project_id) : undefined,
      })),
    ],
    [documents, showProjectName, projectNames],
  );

  const activeFilterCount =
    (projectFilterActive ? 1 : 0) +
    (query.trim() ? 1 : 0) +
    [docFilter, difficultyFilter, typeFilter, reviewFilter].filter((v) => v !== ALL).length;

  function resetFilters() {
    setQuery("");
    setDocFilter(ALL);
    setDifficultyFilter(ALL);
    setTypeFilter(ALL);
    setReviewFilter(ALL);
    setProjectId(ALL_PROJECTS);
  }

  const selectedQuestions = questions.filter((q) => selected.includes(q.id));
  const selectedProjectIds = Array.from(new Set(selectedQuestions.map((q) => q.project_id)));

  return (
    <>
      <PageHeader
        title="문제은행"
        description="여러 문제집이 함께 쓰는 문항 저장소입니다."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowGenerate(true)}>
              AI로 생성
            </Button>
            <Link href="/quiz/bank/new" className={buttonClass("primary")}>
              + 문제 작성
            </Link>
          </>
        }
      />

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: "문제 본문 검색…" }}
        trailing={loading ? "불러오는 중…" : `${questions.length}개 문제`}
        activeCount={activeFilterCount}
        onReset={resetFilters}
      >
        <QuizProjectFilter />
        <Dropdown
          variant="chip"
          label="출처 문서"
          value={docFilter}
          onChange={setDocFilter}
          options={documentOptions}
          searchPlaceholder="문서 이름 검색…"
          emptyLabel="이름이 맞는 문서가 없습니다."
        />
        <Dropdown
          variant="chip"
          label="난이도"
          value={difficultyFilter}
          onChange={setDifficultyFilter}
          options={DIFFICULTY_OPTIONS}
        />
        <Dropdown
          variant="chip"
          label="유형"
          value={typeFilter}
          onChange={setTypeFilter}
          options={TYPE_OPTIONS}
        />
        <Dropdown
          variant="chip"
          label="검수 상태"
          value={reviewFilter}
          onChange={setReviewFilter}
          options={REVIEW_OPTIONS}
        />
      </FilterBar>

      <Card className="overflow-hidden">
        {selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-soft px-5 py-3">
            <span className="text-sm font-medium text-primary">{selected.length}개 선택</span>
            {selected.length < questions.length && (
              <button
                type="button"
                onClick={() => setSelected(questions.map((q) => q.id))}
                className={`rounded-full px-2 py-1 text-xs text-primary/80 underline-offset-2 hover:underline ${FOCUS_RING}`}
              >
                전체 선택
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected([])}
              className={`rounded-full px-2 py-1 text-xs text-primary/80 underline-offset-2 hover:underline ${FOCUS_RING}`}
            >
              선택 해제
            </button>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {selectedProjectIds.length > 1 && (
                <span className="text-xs text-primary/80">
                  같은 프로젝트의 문제만 한 번에 추가할 수 있습니다
                </span>
              )}
              <Button
                onClick={() => setShowAddToBook(true)}
                disabled={selectedProjectIds.length > 1}
              >
                문제집에 추가
              </Button>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={false}
                disabled={questions.length === 0}
                onChange={() => setSelected(questions.map((q) => q.id))}
                className={`h-4 w-4 accent-[var(--color-primary)] ${FOCUS_RING}`}
              />
              전체 선택
            </label>
            <span className="ml-auto text-xs text-ink-muted">
              선택한 문제는 문제집에 한 번에 넣을 수 있습니다
            </span>
          </div>
        )}
        <div className="flex flex-col divide-y divide-border">
          {questions.map((q) => {
            const source = sourceLabel(q, documentNames);
            return (
              <div key={q.id} className="flex items-start gap-3 px-5 py-4 hover:bg-surface">
                <input
                  type="checkbox"
                  checked={selected.includes(q.id)}
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(q.id) ? prev.filter((v) => v !== q.id) : [...prev, q.id],
                    )
                  }
                  aria-label={`${q.text} 선택`}
                  className={`mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)] ${FOCUS_RING}`}
                />
                <div className="min-w-0 flex-1">
                  {showProjectName && (
                    <p className="mb-1 text-xs text-ink-muted">
                      {projectNames.get(q.project_id)}
                    </p>
                  )}
                  <p className="text-sm text-ink">{q.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <QuestionTypeBadge type={q.type} />
                    <DifficultyBadge difficulty={q.difficulty} />
                    <ReviewStatusBadge status={q.review_status} />
                    {source && <span className="text-xs text-ink-muted">📄 {source}</span>}
                  </div>
                </div>
                <IconMenu
                  ariaLabel="문제 메뉴"
                  items={[
                    { key: "edit", label: "수정", onSelect: () => router.push(`/quiz/bank/${q.id}`) },
                    {
                      key: "delete",
                      label: "삭제",
                      tone: "danger",
                      onSelect: () => setDeleteTarget(q),
                      disabled: busy,
                    },
                  ]}
                />
              </div>
            );
          })}
          {!loading && questions.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              조건에 맞는 문제가 없습니다.
            </p>
          )}
        </div>
      </Card>

      <AddToBookModal
        open={showAddToBook && selectedProjectIds.length === 1}
        projectId={String(selectedProjectIds[0] ?? "")}
        questionIds={selected}
        onClose={() => setShowAddToBook(false)}
        onAdded={() => {
          setShowAddToBook(false);
          setSelected([]);
        }}
      />

      <GenerateQuestionsModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerated={() => void load()}
        projects={projects}
        defaultProjectId={
          projectId !== ALL_PROJECTS ? projectId : String(projects[0]?.id ?? "")
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="문제를 삭제하시겠어요?"
        message={
          deleteTarget
            ? `"${deleteTarget.text}"을 문제은행에서 완전히 삭제합니다. 이 문제를 담고 있던 문제집에서도 함께 빠지지만, 이미 제출된 응시 결과는 그대로 남습니다.`
            : ""
        }
        confirmLabel="삭제"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

function AddToBookModal({
  open,
  projectId,
  questionIds,
  onClose,
  onAdded,
}: {
  open: boolean;
  projectId: string;
  questionIds: number[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [books, setBooks] = useState<QuizBook[]>([]);
  const [bookId, setBookId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setDone(null);
    quizApi
      .listBooks(projectId)
      .then((list) => {
        if (cancelled) return;
        setBooks(list);
        setBookId(String(list.find((b) => !b.has_sessions)?.id ?? ""));
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "문제집 목록을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  async function handleAdd() {
    if (!bookId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await quizApi.addBookQuestions(bookId, questionIds);
      setDone(`${books.find((b) => String(b.id) === bookId)?.title}에 추가했습니다 (총 ${result.length}문제).`);
      onAdded();
    } catch (e) {
      setError(
        quizApi.isQuizLockedError(e)
          ? quizApi.QUIZ_LOCKED_MESSAGE
          : errorMessage(e, "문제를 추가하지 못했습니다."),
      );
    } finally {
      setSaving(false);
    }
  }

  const selectable = books.filter((b) => !b.has_sessions);

  return (
    <Modal open={open} onClose={onClose} title="문제집에 추가" className="max-w-sm">
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        {done && <p className="text-sm text-ink-muted">{done}</p>}

        <p className="text-sm text-ink-muted">{questionIds.length}개 문제를 추가합니다.</p>

        {loading ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : selectable.length === 0 ? (
          <p className="text-sm text-ink-muted">
            추가할 수 있는 문제집이 없습니다. 응시 이력이 없는 문제집만 문제 구성을 바꿀 수 있습니다.
          </p>
        ) : (
          <Dropdown
            label="문제집"
            value={bookId}
            onChange={setBookId}
            options={selectable.map((b) => ({
              value: String(b.id),
              label: b.title,
              hint: b.description ?? undefined,
            }))}
            searchPlaceholder="문제집 이름 검색…"
          />
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button
            onClick={() => void handleAdd()}
            disabled={saving || !bookId || selectable.length === 0}
          >
            {saving ? "추가 중…" : "추가"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
