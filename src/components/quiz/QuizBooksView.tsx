"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, buttonClass, ErrorBanner, TONE_STYLES } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { IconMenu } from "@/components/ui/IconMenu";
import { FilterBar } from "@/components/ui/FilterBar";
import { errorMessage, isAuthError } from "@/lib/api";
import { listDocuments } from "@/lib/documents";
import * as quizApi from "@/lib/quiz";
import type { QuizBook, QuizSession } from "@/lib/types";
import {
  ALL_PROJECTS,
  QuizProjectFilter,
  QuizProjectGate,
  useProjectFilterActive,
  useQuizProject,
} from "./QuizProjectProvider";
import { QuizPageShell } from "./QuizPageShell";
import { formatDate, formatDateTime, formatScore, isOverdue, timeLimitLabel } from "./quizFormat";

export function QuizBooksView() {
  return (
    <QuizPageShell>
      <QuizProjectGate>
        <BooksList />
      </QuizProjectGate>
    </QuizPageShell>
  );
}

function BooksList() {
  const { scopeIds, projectId, setProjectId, projectNames } = useQuizProject();
  const projectFilterActive = useProjectFilterActive();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<QuizBook[]>([]);
  const [documentNames, setDocumentNames] = useState<Map<number, string>>(new Map());
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  const [mySessions, setMySessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuizBook | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookLists, sessionLists] = await Promise.all([
        Promise.all(scopeIds.map((pid) => quizApi.listBooks(pid))),
        Promise.all(scopeIds.map((pid) => quizApi.listMySessions(pid))),
      ]);
      const bookList = bookLists
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setBooks(bookList);
      setMySessions(sessionLists.flat());

      const counted = await Promise.all(
        bookList.map(async (b) => {
          try {
            return [b.id, (await quizApi.listBookQuestions(b.id)).length] as const;
          } catch {
            return [b.id, -1] as const;
          }
        }),
      );
      setCounts(new Map(counted.filter(([, n]) => n >= 0)));
    } catch (e) {
      setError(errorMessage(e, "문제집 목록을 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setLoading(false);
    }
  }, [scopeIds]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(scopeIds.map((pid) => listDocuments(String(pid)).catch(() => [])))
      .then((lists) => {
        if (!cancelled) setDocumentNames(new Map(lists.flat().map((d) => [d.id, d.name])));
      })
      .catch(() => {
        if (!cancelled) setDocumentNames(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [scopeIds]);

  async function handleDuplicate(book: QuizBook) {
    setBusy(true);
    try {
      await quizApi.duplicateBook(book.id);
      await load();
    } catch (e) {
      setError(errorMessage(e, "문제집을 복제하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await quizApi.deleteBook(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(errorMessage(e, "문제집을 삭제하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }

  const latestByBook = new Map<number, QuizSession>();
  for (const s of mySessions) {
    if (s.status !== "SUBMITTED") continue;
    const kept = latestByBook.get(s.quiz_book_id);
    if (!kept || new Date(s.created_at) > new Date(kept.created_at)) {
      latestByBook.set(s.quiz_book_id, s);
    }
  }

  const showProjectName = projectId === ALL_PROJECTS;

  const keyword = query.trim().toLowerCase();
  const filtered = keyword
    ? books.filter(
        (b) =>
          b.title.toLowerCase().includes(keyword) ||
          (b.description ?? "").toLowerCase().includes(keyword),
      )
    : books;

  return (
    <>
      <PageHeader
        title="문제집"
        description="문제은행에서 문항을 골라 구성하는 응시 단위입니다."
        actions={
          <Link href="/quiz/new" className={buttonClass("primary")}>
            + 문제집 만들기
          </Link>
        }
      />

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: "문제집 이름 검색…" }}
        trailing={
          loading
            ? "불러오는 중…"
            : filtered.length === books.length
              ? `${books.length}개 문제집`
              : `${filtered.length} / ${books.length}개 문제집`
        }
        activeCount={(query.trim() ? 1 : 0) + (projectFilterActive ? 1 : 0)}
        onReset={() => {
          setQuery("");
          setProjectId(ALL_PROJECTS);
        }}
      >
        <QuizProjectFilter />
      </FilterBar>

      {!loading &&
        (filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-ink-muted">
              {books.length === 0 ? "아직 문제집이 없습니다." : "조건에 맞는 문제집이 없습니다."}
            </p>
            {books.length === 0 && (
              <Link href="/quiz/new" className={buttonClass("primary")}>
                첫 문제집 만들기
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((book) => (
              <QuizBookCard
                key={book.id}
                book={book}
                questionCount={counts.get(book.id)}
                lastSession={latestByBook.get(book.id)}
                documentNames={documentNames}
                projectName={showProjectName ? projectNames.get(book.project_id) : undefined}
                disabled={busy}
                onDuplicate={() => void handleDuplicate(book)}
                onDelete={() => setDeleteTarget(book)}
              />
            ))}
          </div>
        ))}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="문제집을 삭제하시겠어요?"
        message={
          deleteTarget
            ? `"${deleteTarget.title}"을 삭제합니다.${
                deleteTarget.has_sessions
                  ? " 이 문제집의 응시 이력과 답변도 함께 삭제됩니다."
                  : ""
              } 문제은행의 문항은 그대로 남습니다.`
            : ""
        }
        confirmLabel="삭제"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

function QuizBookCard({
  book,
  questionCount,
  lastSession,
  documentNames,
  projectName,
  disabled,
  onDuplicate,
  onDelete,
}: {
  book: QuizBook;
  questionCount: number | undefined;
  lastSession: QuizSession | undefined;
  documentNames: Map<number, string>;
  projectName: string | undefined;
  disabled: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const sources = (book.source_document_ids ?? [])
    .map((id) => documentNames.get(id))
    .filter((name): name is string => Boolean(name));

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {projectName && <p className="mb-1 text-xs text-ink-muted">{projectName}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{book.title}</h3>
            {book.has_sessions && (
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
                🔒 수정 잠김
              </span>
            )}
            {book.due_at && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  isOverdue(book.due_at) ? TONE_STYLES.fail : TONE_STYLES.idle
                }`}
              >
                마감 {formatDateTime(book.due_at)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {book.description || "설명 없음"}
          </p>
        </div>
        <IconMenu
          ariaLabel={`${book.title} 메뉴`}
          items={[
            { key: "duplicate", label: "복제해서 편집", onSelect: onDuplicate, disabled },
            {
              key: "delete",
              label: "삭제",
              tone: "danger",
              onSelect: onDelete,
              disabled: disabled || !book.can_manage,
            },
          ]}
        />
      </div>

      <p className="text-xs text-ink-muted">
        {questionCount == null ? "…" : `${questionCount}문제`} ·{" "}
        {timeLimitLabel(book.time_limit_minutes)} · 합격 {book.passing_score}점
        {book.assignees.length > 0 && <> · {book.assignees.length}명 지정</>}
      </p>

      {sources.length > 0 && (
        <p className="truncate text-xs text-ink-muted" title={sources.join(", ")}>
          📄 {sources.join(" · ")}
        </p>
      )}

      {lastSession && (
        <p className="text-xs text-ink-muted">
          최근 응시 {formatDate(lastSession.created_at)} ·{" "}
          <span className="font-medium text-ink">{formatScore(lastSession.score)}점</span>
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        {book.can_manage && (
          <Link href={`/quiz/${book.id}`} className={buttonClass("outline", "flex-1 justify-center")}>
            문제집 관리
          </Link>
        )}
        <Link
          href={`/quiz/${book.id}/take`}
          className={buttonClass(
            "primary",
            `flex-1 justify-center ${questionCount === 0 ? "pointer-events-none opacity-40" : ""}`,
          )}
          aria-disabled={questionCount === 0}
          tabIndex={questionCount === 0 ? -1 : undefined}
        >
          퀴즈 시작
        </Link>
      </div>
    </Card>
  );
}
