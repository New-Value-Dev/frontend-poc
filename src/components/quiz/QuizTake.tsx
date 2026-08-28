"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BackLink,
  Button,
  Card,
  DifficultyBadge,
  ErrorBanner,
  FOCUS_RING,
  Textarea,
  TONE_STYLES,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useAuth } from "@/components/auth/AuthProvider";
import { errorMessage, isAuthError } from "@/lib/api";
import * as quizApi from "@/lib/quiz";
import type {
  QuizAnswerGradeResult,
  QuizAnswerRecord,
  QuizBook,
  QuizQuestionPlay,
  QuizSessionMode,
} from "@/lib/types";
import { QuizPageShell } from "./QuizPageShell";
import { formatDateTime, isOverdue, timeLimitLabel } from "./quizFormat";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(Math.max(totalSeconds, 0) / 60);
  const s = Math.max(totalSeconds, 0) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function QuizTake({ quizBookId }: { quizBookId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [book, setBook] = useState<QuizBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [session, setSession] = useState<{
    id: number;
    mode: QuizSessionMode;
    questions: QuizQuestionPlay[];
    answers: QuizAnswerRecord[];
    draftAnswers: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    quizApi
      .getBook(quizBookId)
      .then((b) => {
        if (!cancelled) setBook(b);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e, "문제집을 불러오지 못했습니다."));
        setNeedLogin(isAuthError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, quizBookId]);

  if (authLoading || loading) return null;

  if (!book) {
    return (
      <QuizPageShell>
        <BackLink href="/quiz">문제집 목록</BackLink>
        <ErrorBanner message={error ?? "문제집을 찾을 수 없습니다."} needLogin={needLogin} />
      </QuizPageShell>
    );
  }

  if (!user) {
    return (
      <QuizPageShell>
        <BackLink href={`/quiz/${book.id}`}>{book.title}</BackLink>
        <ErrorBanner message="퀴즈 응시는 로그인한 사용자만 가능합니다" needLogin />
      </QuizPageShell>
    );
  }

  if (!session) {
    return (
      <StartScreen
        book={book}
        currentUserId={user.id}
        onStarted={(started) => setSession(started)}
        error={error}
        onError={setError}
      />
    );
  }

  return (
    <PlaySession
      book={book}
      sessionId={session.id}
      mode={session.mode}
      questions={session.questions}
      resumedAnswers={session.answers}
      draftAnswers={session.draftAnswers}
    />
  );
}

function StartScreen({
  book,
  currentUserId,
  onStarted,
  error,
  onError,
}: {
  book: QuizBook;
  currentUserId: number;
  onStarted: (s: {
    id: number;
    mode: QuizSessionMode;
    questions: QuizQuestionPlay[];
    answers: QuizAnswerRecord[];
    draftAnswers: Record<string, string>;
  }) => void;
  error: string | null;
  onError: (message: string | null) => void;
}) {
  const [mode, setMode] = useState<QuizSessionMode>("study");
  const isAssignedToMe = book.assignees.some((a) => a.user_id === currentUserId);
  const overdue = isOverdue(book.due_at);
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    onError(null);
    try {
      const res = await quizApi.startSession(book.id, mode);
      if (res.questions.length === 0) {
        onError("이 문제집에는 아직 문제가 없습니다. 문제집 관리에서 문제를 추가해 주세요.");
        setStarting(false);
        return;
      }
      onStarted({
        id: res.session_id,
        mode: (res.mode as QuizSessionMode) ?? mode,
        questions: res.questions,
        answers: res.answers,
        draftAnswers: res.draft_answers,
      });
    } catch (e) {
      onError(errorMessage(e, "응시를 시작하지 못했습니다."));
      setStarting(false);
    }
  }

  return (
    <QuizPageShell>
      <BackLink href={`/quiz/${book.id}`}>{book.title}</BackLink>

      {error && <ErrorBanner message={error} />}

      <div className="mx-auto w-full max-w-2xl">
        <Card className="flex flex-col gap-5 p-6">
          {isAssignedToMe && (
            <p
              className={`rounded-control p-3 text-xs leading-relaxed ${
                overdue ? TONE_STYLES.fail : TONE_STYLES.active
              }`}
            >
              {overdue ? "마감이 지났습니다" : "이 퀴즈에 배정되었습니다"}
              {book.due_at && <> — 마감 {formatDateTime(book.due_at)}</>}
            </p>
          )}

          <div>
            <h1 className="text-lg font-semibold text-ink">{book.title}</h1>
            {book.description && (
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{book.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs text-ink-muted">
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5">
              {timeLimitLabel(book.time_limit_minutes)}
            </span>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5">
              합격 {book.passing_score}점
            </span>
            {book.shuffle_questions && (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5">문제 순서 랜덤</span>
            )}
            {book.shuffle_options && (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5">보기 순서 랜덤</span>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-ink">응시 모드</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              시작하면 모드를 바꿀 수 없습니다.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              <ModeOption
                checked={mode === "study"}
                onSelect={() => setMode("study")}
                title="학습 모드"
                detail="한 문제씩 답하면 바로 정답과 해설을 보여줍니다."
              />
              <ModeOption
                checked={mode === "exam"}
                onSelect={() => setMode("exam")}
                title="시험 모드"
                detail="제출하기 전까지 채점 결과를 보여주지 않습니다."
              />
            </div>
          </div>

          {!book.allow_retake && (
            <p className="rounded-control bg-surface p-3 text-xs leading-relaxed text-ink-muted">
              이 문제집은 재응시를 권장하지 않도록 설정돼 있습니다.
            </p>
          )}

          <Button onClick={() => void start()} disabled={starting}>
            {starting ? "시작 중…" : "응시 시작"}
          </Button>
        </Card>
      </div>
    </QuizPageShell>
  );
}

function ModeOption({
  checked,
  onSelect,
  title,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-control border px-3.5 py-3 transition-colors ${
        checked ? "border-primary/40 bg-primary-soft" : "border-border hover:bg-surface"
      }`}
    >
      <input
        type="radio"
        name="quiz-mode"
        checked={checked}
        onChange={onSelect}
        className={`mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)] ${FOCUS_RING}`}
      />
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${checked ? "text-primary" : "text-ink"}`}>
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">{detail}</span>
      </span>
    </label>
  );
}

function PlaySession({
  book,
  sessionId,
  mode,
  questions,
  resumedAnswers,
  draftAnswers,
}: {
  book: QuizBook;
  sessionId: number;
  mode: QuizSessionMode;
  questions: QuizQuestionPlay[];
  resumedAnswers: QuizAnswerRecord[];
  draftAnswers: Record<string, string>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const r of resumedAnswers) {
      if (r.question_id != null) init[r.question_id] = r.user_answer;
    }
    for (const [qid, value] of Object.entries(draftAnswers)) {
      init[Number(qid)] = value;
    }
    return init;
  });
  const [feedback, setFeedback] = useState<Record<number, QuizAnswerGradeResult>>(() => {
    const init: Record<number, QuizAnswerGradeResult> = {};
    for (const r of resumedAnswers) {
      if (r.question_id != null) {
        init[r.question_id] = {
          is_correct: r.is_correct,
          correct_answer: r.correct_answer ?? "",
          explanation: r.explanation ?? "",
          score: r.score,
          feedback: r.feedback,
        };
      }
    }
    return init;
  });
  const [index, setIndex] = useState(() => {
    const answeredIds = new Set(Object.keys(answers).map(Number));
    if (answeredIds.size === 0) return 0;
    const firstUnanswered = questions.findIndex((q) => !answeredIds.has(q.id));
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const [grading, setGrading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(
    book.time_limit_minutes == null ? null : book.time_limit_minutes * 60,
  );

  const [displayOrder] = useState(() => {
    const order = new Map<number, number[]>();
    if (!book.shuffle_options) return order;
    for (const q of questions) {
      if (q.options) order.set(q.id, shuffled(q.options.map((_, i) => i)));
    }
    return order;
  });

  const submit = useCallback(
    async (auto = false) => {
      setSubmitting(true);
      setError(null);
      try {
        await quizApi.submitSession(
          book.id,
          sessionId,
          questions.map((q) => ({ question_id: q.id, user_answer: answers[q.id] ?? "" })),
        );
        router.push(`/quiz/${book.id}/result?session=${sessionId}`);
      } catch (e) {
        setError(
          auto
            ? errorMessage(e, "시간이 끝나 자동 제출하려 했지만 실패했습니다.")
            : errorMessage(e, "제출하지 못했습니다."),
        );
        setSubmitting(false);
      }
    },
    [answers, book.id, questions, router, sessionId],
  );

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  useEffect(() => {
    if (remaining == null) return;
    if (remaining <= 0) {
      void submitRef.current(true);
      return;
    }
    const timer = setTimeout(() => setRemaining((s) => (s == null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const question = questions[index];
  const answered = Object.keys(answers).length;
  const currentAnswer = answers[question.id];
  const currentFeedback = feedback[question.id];
  const locked = mode === "study" && currentFeedback !== undefined;

  const [pendingDraft, setPendingDraft] = useState<{ questionId: number; value: string } | null>(
    null,
  );
  useEffect(() => {
    if (mode !== "exam" || !pendingDraft) return;
    const { questionId, value } = pendingDraft;
    const timer = setTimeout(() => {
      void quizApi
        .saveDraftAnswer(book.id, sessionId, { question_id: questionId, user_answer: value })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [pendingDraft, mode, book.id, sessionId]);

  function queueDraftSave(questionId: number, value: string) {
    if (mode !== "exam") return;
    setPendingDraft({ questionId, value });
  }

  async function selectAnswer(value: string) {
    if (locked || grading) return;
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    queueDraftSave(question.id, value);

    if (mode !== "study") return;
    setGrading(true);
    setError(null);
    try {
      const result = await quizApi.gradeAnswer(book.id, sessionId, {
        question_id: question.id,
        user_answer: value,
      });
      setFeedback((prev) => ({ ...prev, [question.id]: result }));
    } catch (e) {
      setError(errorMessage(e, "채점하지 못했습니다."));
    } finally {
      setGrading(false);
    }
  }

  const isShortAnswer = question.type === "SHORT_ANSWER";
  const isEssay = question.type === "ESSAY";
  const [draft, setDraft] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(answers[question.id] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const optionIndexes =
    displayOrder.get(question.id) ?? question.options?.map((_, i) => i) ?? [];

  return (
    <QuizPageShell>
      <div className="flex items-center justify-between gap-3">
        <BackLink href={`/quiz/${book.id}`}>{book.title}</BackLink>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted">
          {mode === "study" ? "학습 모드" : "시험 모드"}
        </span>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="tnum">
              {index + 1} / {questions.length}
            </span>
            {remaining != null && (
              <span className={`tnum font-medium ${remaining <= 60 ? "text-primary" : ""}`}>
                남은 시간 {formatClock(remaining)}
              </span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-panel border border-border bg-canvas p-5">
          <div className="mb-3 flex items-center gap-2">
            <DifficultyBadge difficulty={question.difficulty} />
          </div>
          <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-ink">
            {question.text}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {question.type === "SINGLE_CHOICE" &&
              optionIndexes.map((originalIndex) => {
                const value = String(originalIndex);
                const selected = currentAnswer === value;
                const isAnswer = currentFeedback?.correct_answer === value;
                const tone = currentFeedback
                  ? isAnswer
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : selected
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border text-ink-muted"
                  : selected
                    ? "border-primary/40 bg-primary-soft text-primary"
                    : "border-border text-ink hover:bg-surface";
                return (
                  <button
                    key={originalIndex}
                    type="button"
                    onClick={() => void selectAnswer(value)}
                    disabled={locked || grading}
                    className={`rounded-control border px-3.5 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed ${FOCUS_RING} ${tone}`}
                  >
                    {question.options?.[originalIndex]}
                  </button>
                );
              })}

            {question.type === "TRUE_FALSE" &&
              (["O", "X"] as const).map((v) => {
                const selected = currentAnswer === v;
                const isAnswer = currentFeedback?.correct_answer === v;
                const tone = currentFeedback
                  ? isAnswer
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : selected
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border text-ink-muted"
                  : selected
                    ? "border-primary/40 bg-primary-soft text-primary"
                    : "border-border text-ink hover:bg-surface";
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => void selectAnswer(v)}
                    disabled={locked || grading}
                    className={`rounded-control border px-3.5 py-2.5 text-center text-sm font-medium transition-colors disabled:cursor-not-allowed ${FOCUS_RING} ${tone}`}
                  >
                    {v}
                  </button>
                );
              })}

            {isShortAnswer && (
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (mode === "exam") {
                      setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }));
                      queueDraftSave(question.id, e.target.value);
                    }
                  }}
                  disabled={locked}
                  placeholder="답을 입력하세요"
                  className={`w-full rounded-control border px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:bg-surface ${
                    currentFeedback
                      ? currentFeedback.is_correct
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-primary/40 bg-primary-soft"
                      : "border-border"
                  }`}
                />
                {mode === "study" && (
                  <Button
                    variant="outline"
                    className="shrink-0 whitespace-nowrap"
                    onClick={() => void selectAnswer(draft)}
                    disabled={locked || grading || !draft.trim()}
                  >
                    {grading ? "채점 중…" : "확인"}
                  </Button>
                )}
              </div>
            )}

            {isEssay && (
              <div className="flex flex-col gap-2">
                <Textarea
                  rows={6}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (mode === "exam") {
                      setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }));
                      queueDraftSave(question.id, e.target.value);
                    }
                  }}
                  disabled={locked}
                  placeholder="답을 서술하세요"
                  className={
                    currentFeedback
                      ? currentFeedback.is_correct
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-primary/40 bg-primary-soft"
                      : ""
                  }
                />
                {mode === "study" && (
                  <Button
                    variant="outline"
                    className="self-end whitespace-nowrap"
                    onClick={() => void selectAnswer(draft)}
                    disabled={locked || grading || !draft.trim()}
                  >
                    {grading ? "채점 중…" : "채점하기"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {currentFeedback && (
            <div className="mt-4 rounded-control bg-surface p-3.5 text-sm">
              {currentFeedback.score != null ? (
                <p className="font-medium text-ink">
                  점수 <span className="tnum">{currentFeedback.score}</span> / 100
                </p>
              ) : (
                <p
                  className={`font-medium ${
                    currentFeedback.is_correct ? "text-emerald-700" : "text-primary"
                  }`}
                >
                  {currentFeedback.is_correct ? "정답입니다" : "오답입니다"}
                  {!currentFeedback.is_correct && question.type !== "SINGLE_CHOICE" && (
                    <span className="ml-1 whitespace-pre-wrap font-normal text-ink-muted">
                      (정답: {currentFeedback.correct_answer})
                    </span>
                  )}
                </p>
              )}
              {currentFeedback.score != null && currentFeedback.feedback && (
                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-ink-muted">
                  {currentFeedback.feedback}
                </p>
              )}
              {currentFeedback.score == null && currentFeedback.explanation && (
                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-ink-muted">
                  {currentFeedback.explanation}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
          >
            이전
          </Button>
          <span className="text-xs text-ink-muted tnum">
            {answered} / {questions.length} 답변함
          </span>
          {index < questions.length - 1 ? (
            <Button onClick={() => setIndex((i) => Math.min(i + 1, questions.length - 1))}>
              다음
            </Button>
          ) : (
            <Button onClick={() => setConfirmSubmit(true)} disabled={submitting}>
              {submitting
                ? questions.some((q) => q.type === "ESSAY")
                  ? "채점 중…"
                  : "제출 중…"
                : "제출"}
            </Button>
          )}
        </div>

        <ConfirmDialog
          open={confirmSubmit}
          title="퀴즈를 제출하시겠어요?"
          message={`${questions.length}문제 중 ${answered}문제에 답했습니다. 답하지 않은 문제는 오답으로 처리되고, 제출 후에는 답을 바꿀 수 없습니다.`}
          confirmLabel="제출"
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={() => {
            setConfirmSubmit(false);
            void submit();
          }}
        />
      </div>
    </QuizPageShell>
  );
}
