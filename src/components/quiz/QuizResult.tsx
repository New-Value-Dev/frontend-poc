"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BackLink,
  Card,
  CardHeader,
  CardTitle,
  buttonClass,
  DifficultyBadge,
  ErrorBanner,
} from "@/components/ui/primitives";
import { BarList } from "@/components/charts";
import { useAuth } from "@/components/auth/AuthProvider";
import { errorMessage, isAuthError } from "@/lib/api";
import * as quizApi from "@/lib/quiz";
import type { QuizAnswerRecord, QuizBook, QuizQuestion, QuizSessionResult } from "@/lib/types";
import { QuizPageShell } from "./QuizPageShell";
import { displayRecordAnswer, formatDateTime, formatScore } from "./quizFormat";

const DIFFICULTY_ORDER = ["EASY", "MEDIUM", "HARD"] as const;

export function QuizResult({
  quizBookId,
  sessionId,
}: {
  quizBookId: string;
  sessionId?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const [book, setBook] = useState<QuizBook | null>(null);
  const [session, setSession] = useState<QuizSessionResult | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const b = await quizApi.getBook(quizBookId);
        if (cancelled) return;
        setBook(b);

        // `?session=`이 없으면(응시 직후 리다이렉트가 아닌 진입) 내 최근 제출 세션을 찾는다.
        let targetId = sessionId;
        if (!targetId) {
          const mine = await quizApi.listMySessions(b.project_id);
          const latest = mine
            .filter((s) => s.quiz_book_id === b.id && s.status === "SUBMITTED")
            .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())[0];
          if (!latest) {
            if (!cancelled) setLoading(false);
            return;
          }
          targetId = String(latest.id);
        }

        const [detail, bookQuestions] = await Promise.all([
          quizApi.getSession(b.id, targetId),
          quizApi.listBookQuestions(b.id).catch(() => [] as QuizQuestion[]),
        ]);
        if (cancelled) return;
        setSession(detail);
        setQuestions(bookQuestions);
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e, "응시 결과를 불러오지 못했습니다."));
        setNeedLogin(isAuthError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, quizBookId, sessionId]);

  if (authLoading || loading) return null;

  if (!book) {
    return (
      <QuizPageShell>
        <BackLink href="/quiz">문제집 목록</BackLink>
        <ErrorBanner message={error ?? "문제집을 찾을 수 없습니다."} needLogin={needLogin} />
      </QuizPageShell>
    );
  }

  if (!session) {
    return (
      <QuizPageShell>
        <BackLink href={`/quiz/${book.id}?tab=results`}>{book.title}</BackLink>
        {error ? (
          <ErrorBanner message={error} needLogin={needLogin} />
        ) : (
          <p className="text-sm text-ink-muted">아직 이 문제집의 응시 결과가 없습니다.</p>
        )}
        <Link href={`/quiz/${book.id}/take`} className={buttonClass("primary", "w-fit")}>
          퀴즈 시작
        </Link>
      </QuizPageShell>
    );
  }

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const wrong = session.answers.filter((a) => !a.is_correct);
  const passed = (session.score ?? 0) >= book.passing_score;
  const answersHidden = session.answers.length > 0 && session.answers.every((a) => a.correct_answer == null);
  const viewingOthers = user != null && session.user_id !== user.id;

  const difficultyBreakdown = DIFFICULTY_ORDER.map((level) => {
    const records = session.answers.filter((a) => {
      const q = a.question_id != null ? questionById.get(a.question_id) : undefined;
      return q?.difficulty === level;
    });
    return {
      label: level === "EASY" ? "쉬움" : level === "MEDIUM" ? "보통" : "어려움",
      value: records.length
        ? Math.round((records.filter((a) => a.is_correct).length / records.length) * 100)
        : 0,
      count: records.length,
    };
  }).filter((row) => row.count > 0);

  const sourceTitles = Array.from(
    new Set(
      session.answers
        .map((a) => {
          const q = a.question_id != null ? questionById.get(a.question_id) : undefined;
          return q?.source_document_title ?? null;
        })
        .filter((t): t is string => t != null),
    ),
  );
  const tagBreakdown = sourceTitles.map((title) => {
    const records = session.answers.filter((a) => {
      const q = a.question_id != null ? questionById.get(a.question_id) : undefined;
      return q?.source_document_title === title;
    });
    return {
      label: title,
      value: records.length
        ? Math.round((records.filter((a) => a.is_correct).length / records.length) * 100)
        : 0,
    };
  });

  return (
    <QuizPageShell>
      <BackLink href={`/quiz/${book.id}?tab=results`}>{book.title}</BackLink>

        {viewingOthers && (
          <div className="flex items-center gap-3 rounded-panel border border-border bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-ink">
              {(session.user_name ?? session.user_email ?? "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {session.user_name ?? session.user_email ?? `사용자 #${session.user_id}`}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {session.user_name && session.user_email ? session.user_email : "응시자 결과"}
              </p>
            </div>
          </div>
        )}

        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <p className="text-sm text-ink-muted">{book.title}</p>
          <p className="text-5xl font-semibold text-ink tnum">{formatScore(session.score)}</p>
          <p className="text-sm text-ink-muted tnum">
            {session.correct_count} / {session.total_count} 정답
          </p>
          <span
            className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              passed ? "bg-emerald-50 text-emerald-700" : "bg-primary-soft text-primary"
            }`}
          >
            {passed ? "합격" : "불합격"} (기준 {book.passing_score}점)
          </span>
          {session.submitted_at && (
            <p className="mt-1 text-xs text-ink-muted">{formatDateTime(session.submitted_at)}</p>
          )}
        </Card>

        {(difficultyBreakdown.length > 0 || tagBreakdown.length > 0) && (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            {difficultyBreakdown.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>난이도별 정답률</CardTitle>
                </CardHeader>
                <div className="p-5">
                  <BarList items={difficultyBreakdown.map(({ label, value }) => ({ label, value }))} />
                </div>
              </Card>
            )}
            {tagBreakdown.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>분야별 정답률</CardTitle>
                </CardHeader>
                <div className="p-5">
                  <BarList items={tagBreakdown} />
                </div>
              </Card>
            )}
          </div>
        )}

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>오답노트</CardTitle>
            <span className="text-xs text-ink-muted tnum">
              {wrong.length} / {session.answers.length}
            </span>
          </CardHeader>
          {answersHidden && (
            <p className="border-b border-border bg-surface px-5 py-3 text-xs text-ink-muted">
              이 문제집은 정답 공개가 꺼져 있어 정답과 해설이 표시되지 않습니다.
            </p>
          )}
          <div className="flex flex-col divide-y divide-border">
            {wrong.map((record, i) => (
              <WrongAnswerRow
                key={record.question_id ?? `deleted-${i}`}
                record={record}
                difficulty={
                  record.question_id != null
                    ? questionById.get(record.question_id)?.difficulty
                    : undefined
                }
              />
            ))}
            {wrong.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">
                틀린 문제가 없습니다.
              </p>
            )}
          </div>
        </Card>

        <div className="flex justify-center gap-2">
          <Link href={`/quiz/${book.id}?tab=results`} className={buttonClass("outline")}>
            문제집으로
          </Link>
          {!viewingOthers && (
            <Link href={`/quiz/${book.id}/take`} className={buttonClass("primary")}>
              다시 응시
            </Link>
          )}
        </div>
    </QuizPageShell>
  );
}

function WrongAnswerRow({
  record,
  difficulty,
}: {
  record: QuizAnswerRecord;
  difficulty?: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="whitespace-pre-wrap text-sm text-ink">{record.question_text}</p>
        {difficulty && <DifficultyBadge difficulty={difficulty} />}
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        <p>
          <span className="text-xs text-ink-muted">내 답 </span>
          <span className="whitespace-pre-wrap text-primary">
            {displayRecordAnswer(record, record.user_answer)}
          </span>
        </p>
        {record.correct_answer != null && (
          <p>
            <span className="text-xs text-ink-muted">정답 </span>
            <span className="whitespace-pre-wrap font-medium text-emerald-700">
              {displayRecordAnswer(record, record.correct_answer)}
            </span>
          </p>
        )}
      </div>
      {record.score != null && (
        <p className="mt-2.5 text-sm font-medium text-ink">
          점수 <span className="tnum">{record.score}</span> / 100
        </p>
      )}
      {record.score != null && record.feedback && (
        <p className="mt-2 whitespace-pre-wrap rounded-control bg-surface p-3 text-sm leading-relaxed text-ink-muted">
          {record.feedback}
        </p>
      )}
      {record.score == null && record.explanation && (
        <p className="mt-2 whitespace-pre-wrap rounded-control bg-surface p-3 text-sm leading-relaxed text-ink-muted">
          {record.explanation}
        </p>
      )}
      {record.question_id == null && (
        <p className="mt-2 text-xs text-ink-muted">
          이 문항은 이후 문제은행에서 삭제됐습니다 (제출 시점 내용).
        </p>
      )}
    </div>
  );
}
