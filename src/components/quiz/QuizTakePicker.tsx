"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, buttonClass, ErrorBanner } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/FilterBar";
import { errorMessage, isAuthError } from "@/lib/api";
import * as quizApi from "@/lib/quiz";
import type { QuizBook } from "@/lib/types";
import {
  ALL_PROJECTS,
  QuizProjectFilter,
  QuizProjectGate,
  useProjectFilterActive,
  useQuizProject,
} from "./QuizProjectProvider";
import { QuizPageShell } from "./QuizPageShell";
import { timeLimitLabel } from "./quizFormat";

export function QuizTakePicker() {
  return (
    <QuizPageShell>
      <QuizProjectGate>
        <Picker />
      </QuizProjectGate>
    </QuizPageShell>
  );
}

function Picker() {
  const { scopeIds, projectId, setProjectId, projectNames } = useQuizProject();
  const projectFilterActive = useProjectFilterActive();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<QuizBook[]>([]);
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const lists = await Promise.all(scopeIds.map((pid) => quizApi.listBooks(pid)));
        if (cancelled) return;
        const list = lists
          .flat()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setBooks(list);
        const counted = await Promise.all(
          list.map(async (b) => {
            try {
              return [b.id, (await quizApi.listBookQuestions(b.id)).length] as const;
            } catch {
              return [b.id, -1] as const;
            }
          }),
        );
        if (!cancelled) setCounts(new Map(counted.filter(([, n]) => n >= 0)));
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e, "문제집 목록을 불러오지 못했습니다."));
        setNeedLogin(isAuthError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scopeIds]);

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
        title="퀴즈 응시"
        description="응시할 문제집을 선택하세요. 학습·시험 모드는 다음 화면에서 고릅니다."
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

      <div className="flex flex-col gap-3">
        {filtered.map((book) => {
          const count = counts.get(book.id);
          const empty = count === 0;
          return (
            <Card key={book.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                {showProjectName && (
                  <p className="text-xs text-ink-muted">{projectNames.get(book.project_id)}</p>
                )}
                <p className="text-sm font-semibold text-ink">{book.title}</p>
                {book.description && (
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{book.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-ink-muted">
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5">
                    {count == null ? "…" : `${count}문제`}
                  </span>
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5">
                    {timeLimitLabel(book.time_limit_minutes)}
                  </span>
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5">
                    합격 {book.passing_score}점
                  </span>
                </div>
              </div>
              {empty ? (
                <span className="shrink-0 text-xs text-ink-muted">문제 없음</span>
              ) : (
                <Link href={`/quiz/${book.id}/take`} className={buttonClass("primary", "shrink-0")}>
                  응시 시작
                </Link>
              )}
            </Card>
          );
        })}
        {!loading && filtered.length === 0 && (
          <Card className="p-10 text-center text-sm text-ink-muted">
            {books.length === 0
              ? "아직 만들어진 문제집이 없습니다."
              : "조건에 맞는 문제집이 없습니다."}
          </Card>
        )}
      </div>
    </>
  );
}
