"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  ErrorBanner,
  FOCUS_RING,
} from "@/components/ui/primitives";
import { errorMessage, isAuthError } from "@/lib/api";
import * as quizApi from "@/lib/quiz";
import type { QuizBook, QuizSession } from "@/lib/types";
import { FilterBar } from "@/components/ui/FilterBar";
import {
  ALL_PROJECTS,
  QuizProjectFilter,
  QuizProjectGate,
  useProjectFilterActive,
  useQuizProject,
} from "./QuizProjectProvider";
import { QuizPageShell } from "./QuizPageShell";
import { formatDateTime, formatScore } from "./quizFormat";

export function QuizResultsOverview() {
  return (
    <QuizPageShell>
      <QuizProjectGate>
        <Overview />
      </QuizProjectGate>
    </QuizPageShell>
  );
}

function Overview() {
  const { scopeIds, setProjectId } = useQuizProject();
  const projectFilterActive = useProjectFilterActive();
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [inProgress, setInProgress] = useState<QuizSession[]>([]);
  const [books, setBooks] = useState<QuizBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    Promise.all([
      Promise.all(scopeIds.map((pid) => quizApi.listMySessions(pid))),
      Promise.all(scopeIds.map((pid) => quizApi.listMySessions(pid, { status: "IN_PROGRESS" }))),
      Promise.all(scopeIds.map((pid) => quizApi.listBooks(pid))),
    ])
      .then(([sessionLists, inProgressLists, bookLists]) => {
        if (cancelled) return;
        setSessions(sessionLists.flat());
        setInProgress(inProgressLists.flat());
        setBooks(bookLists.flat());
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "응시 이력을 불러오지 못했습니다."));
        setNeedLogin(isAuthError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeIds]);

  const bookById = new Map(books.map((b) => [b.id, b]));
  const submitted = sessions
    .filter((s) => s.status === "SUBMITTED")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const average = submitted.length
    ? Math.round(submitted.reduce((sum, s) => sum + (s.score ?? 0), 0) / submitted.length)
    : null;

  return (
    <>
      <PageHeader
        title="결과 · 오답"
        description="내 응시 이력입니다. 각 행을 눌러 점수와 오답노트를 확인하세요."
      />

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      <FilterBar
        trailing={loading ? "불러오는 중…" : `${submitted.length}건 응시`}
        activeCount={projectFilterActive ? 1 : 0}
        onReset={() => setProjectId(ALL_PROJECTS)}
      >
        <QuizProjectFilter />
      </FilterBar>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink-muted">내 응시 횟수</p>
          <p className="mt-1 text-2xl font-semibold text-ink tnum">{submitted.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">평균 점수</p>
          <p className="mt-1 text-2xl font-semibold text-ink tnum">{average ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">문제집 수</p>
          <p className="mt-1 text-2xl font-semibold text-ink tnum">{books.length}</p>
        </Card>
      </div>

      {inProgress.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>진행 중</CardTitle>
            <span className="text-xs text-ink-muted tnum">{inProgress.length}건</span>
          </CardHeader>
          <div className="flex flex-col divide-y divide-border">
            {inProgress.map((s) => {
              const book = bookById.get(s.quiz_book_id);
              return (
                <Link
                  key={s.id}
                  href={`/quiz/${s.quiz_book_id}/take`}
                  className={`flex items-center justify-between gap-4 px-5 py-3.5 text-sm hover:bg-surface ${FOCUS_RING}`}
                >
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {book?.title ?? `문제집 #${s.quiz_book_id}`}
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {formatDateTime(s.created_at)} 시작
                  </span>
                  <span className="shrink-0 font-medium text-primary">이어서 풀기 →</span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>응시 이력</CardTitle>
        </CardHeader>
        <div className="flex flex-col divide-y divide-border">
          {submitted.map((s) => {
            const book = bookById.get(s.quiz_book_id);
            const passed = book ? (s.score ?? 0) >= book.passing_score : false;
            return (
              <Link
                key={s.id}
                href={`/quiz/${s.quiz_book_id}/result?session=${s.id}`}
                className={`flex items-center justify-between gap-4 px-5 py-3.5 text-sm hover:bg-surface ${FOCUS_RING}`}
              >
                <span className="min-w-0 flex-1 truncate text-ink">
                  {book?.title ?? `문제집 #${s.quiz_book_id}`}
                </span>
                <span className="shrink-0 text-ink-muted">{formatDateTime(s.created_at)}</span>
                <span className="shrink-0 text-ink-muted tnum">
                  {s.correct_count}/{s.total_count} 정답
                </span>
                <span
                  className={`shrink-0 font-semibold tnum ${passed ? "text-emerald-700" : "text-primary"}`}
                >
                  {formatScore(s.score)}점
                </span>
              </Link>
            );
          })}
          {!loading && submitted.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              아직 제출한 응시 이력이 없습니다.
            </p>
          )}
          {loading && <p className="px-5 py-8 text-center text-sm text-ink-muted">불러오는 중…</p>}
        </div>
      </Card>
    </>
  );
}
