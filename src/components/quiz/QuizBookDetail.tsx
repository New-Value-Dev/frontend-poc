"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  BackLink,
  Card,
  CardHeader,
  CardTitle,
  Button,
  buttonClass,
  ErrorBanner,
  Field,
  Input,
  Textarea,
  FOCUS_RING,
  QuestionTypeBadge,
  DifficultyBadge,
  ReviewStatusBadge,
} from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { IconMenu } from "@/components/ui/IconMenu";
import { SearchInput } from "@/components/ui/FilterBar";
import { useAuth } from "@/components/auth/AuthProvider";
import { errorMessage, isAuthError } from "@/lib/api";
import { listDocuments } from "@/lib/documents";
import * as quizApi from "@/lib/quiz";
import type { Document, QuizBook, QuizQuestion, QuizSession } from "@/lib/types";
import { QuizPageShell } from "./QuizPageShell";
import { GenerateQuestionsModal } from "./GenerateQuestionsModal";
import { LockedBanner, QuizToggleField } from "./QuizFields";
import { formatDateTime, formatScore, sourceLabel } from "./quizFormat";

const tabs = [
  { key: "questions", label: "문제" },
  { key: "settings", label: "설정" },
  { key: "results", label: "응시 결과" },
] as const;
type TabKey = (typeof tabs)[number]["key"];

export function QuizBookDetail({ quizBookId }: { quizBookId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [active, setActive] = useState<TabKey>("questions");
  const [book, setBook] = useState<QuizBook | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, qs] = await Promise.all([
        quizApi.getBook(quizBookId),
        quizApi.listBookQuestions(quizBookId),
      ]);
      setBook(b);
      setQuestions(qs);
      listDocuments(String(b.project_id))
        .then(setDocuments)
        .catch(() => setDocuments([]));
    } catch (e) {
      setError(errorMessage(e, "문제집을 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setLoading(false);
    }
  }, [quizBookId]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [authLoading, load]);

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const copy = await quizApi.duplicateBook(quizBookId);
      router.push(`/quiz/${copy.id}`);
    } catch (e) {
      setError(errorMessage(e, "문제집을 복제하지 못했습니다."));
      setDuplicating(false);
    }
  }

  if (authLoading || loading) return null;

  if (!book) {
    return (
      <QuizPageShell>
        <BackLink href="/quiz">문제집 목록</BackLink>
        <ErrorBanner message={error ?? "문제집을 찾을 수 없습니다."} needLogin={needLogin} />
      </QuizPageShell>
    );
  }

  const documentNames = new Map(documents.map((d) => [d.id, d.name]));

  return (
    <QuizPageShell>
      <BackLink href="/quiz">문제집 목록</BackLink>

      <PageHeader
        title={book.title}
        titleBadge={
          book.has_sessions ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
              🔒 수정 잠김
            </span>
          ) : undefined
        }
        description={book.description ?? undefined}
        actions={
          <Link
            href={`/quiz/${book.id}/take`}
            className={buttonClass(
              "primary",
              questions.length === 0 ? "pointer-events-none opacity-40" : "",
            )}
            aria-disabled={questions.length === 0}
            tabIndex={questions.length === 0 ? -1 : undefined}
          >
            퀴즈 시작
          </Link>
        }
      />

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      {book.has_sessions && (
        <LockedBanner onDuplicate={() => void handleDuplicate()} busy={duplicating} />
      )}

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            aria-current={active === t.key ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-t-control px-3 py-2 text-sm transition-colors ${FOCUS_RING} focus-visible:ring-offset-0 ${
              active === t.key
                ? "border-b-2 border-primary font-medium text-primary"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.key === "questions" && (
              <span className="ml-1.5 text-xs text-ink-muted">{questions.length}</span>
            )}
          </button>
        ))}
      </div>

      {active === "questions" && (
        <QuestionsTab
          book={book}
          questions={questions}
          documentNames={documentNames}
          onChanged={load}
        />
      )}
      {active === "settings" && (
        <SettingsTab book={book} questionCount={questions.length} onSaved={load} />
      )}
      {active === "results" && <ResultsTab book={book} currentUserId={user?.id ?? null} />}
    </QuizPageShell>
  );
}

function QuestionsTab({
  book,
  questions,
  documentNames,
  onChanged,
}: {
  book: QuizBook;
  questions: QuizQuestion[];
  documentNames: Map<number, string>;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<QuizQuestion | null>(null);
  const [showBank, setShowBank] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = book.has_sessions;

  async function handleRemove() {
    if (!removeTarget) return;
    setBusy(true);
    setError(null);
    try {
      await quizApi.removeBookQuestion(book.id, removeTarget.id);
      setRemoveTarget(null);
      await onChanged();
    } catch (e) {
      setError(
        quizApi.isQuizLockedError(e)
          ? quizApi.QUIZ_LOCKED_MESSAGE
          : errorMessage(e, "문제를 제외하지 못했습니다."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <ErrorBanner message={error} />}

      <Card className="overflow-hidden">
        <div className="flex flex-col divide-y divide-border">
          {questions.map((q, i) => {
            const source = sourceLabel(q, documentNames);
            return (
              <div key={q.id} className="flex items-start gap-3 px-5 py-4">
                <span className="mt-0.5 shrink-0 font-mono text-xs text-ink-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{q.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <QuestionTypeBadge type={q.type} />
                    <DifficultyBadge difficulty={q.difficulty} />
                    <ReviewStatusBadge status={q.review_status} />
                    {source && <span className="text-xs text-ink-muted">📄 {source}</span>}
                  </div>
                </div>
                <IconMenu
                  ariaLabel={`${i + 1}번 문제 메뉴`}
                  items={[
                    {
                      key: "edit",
                      label: "문제 수정",
                      onSelect: () => router.push(`/quiz/bank/${q.id}?book=${book.id}`),
                    },
                    {
                      key: "remove",
                      label: "문제집에서 제외",
                      tone: "danger",
                      onSelect: () => setRemoveTarget(q),
                      disabled: locked || busy,
                    },
                  ]}
                />
              </div>
            );
          })}
          {questions.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              아직 문제가 없습니다. 문제은행에서 편입하거나 직접 작성해 주세요.
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {locked ? (
          <Button variant="outline" disabled>
            + 직접 작성
          </Button>
        ) : (
          <Link href={`/quiz/bank/new?book=${book.id}`} className={buttonClass("outline")}>
            + 직접 작성
          </Link>
        )}
        <Button variant="outline" onClick={() => setShowBank(true)} disabled={locked}>
          + 문제은행에서 추가
        </Button>
        <Button variant="outline" onClick={() => setShowGenerate(true)} disabled={locked}>
          AI로 생성
        </Button>
      </div>

      <AddFromBankModal
        open={showBank}
        book={book}
        excludeIds={questions.map((q) => q.id)}
        documentNames={documentNames}
        onClose={() => setShowBank(false)}
        onAdded={() => {
          setShowBank(false);
          void onChanged();
        }}
      />

      <GenerateQuestionsModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerated={() => void onChanged()}
        projects={[]}
        defaultProjectId={String(book.project_id)}
        fixedBook={{ id: book.id, title: book.title, project_id: book.project_id }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        title="문제집에서 제외하시겠어요?"
        message={
          removeTarget
            ? `"${removeTarget.text}"을 이 문제집에서 제외합니다. 문제은행에는 그대로 남습니다.`
            : ""
        }
        confirmLabel="제외"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void handleRemove()}
      />
    </>
  );
}

function AddFromBankModal({
  open,
  book,
  excludeIds,
  documentNames,
  onClose,
  onAdded,
}: {
  open: boolean;
  book: QuizBook;
  excludeIds: number[];
  documentNames: Map<number, string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [candidates, setCandidates] = useState<QuizQuestion[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSelected([]);
    setQuery("");
    setError(null);
    quizApi
      .listQuestions(book.project_id)
      .then((list) => {
        if (!cancelled) setCandidates(list.filter((q) => !excludeIds.includes(q.id)));
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "문제은행을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, book.project_id]);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      await quizApi.addBookQuestions(book.id, selected);
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

  const keyword = query.trim().toLowerCase();
  const visible = keyword
    ? candidates.filter((q) => q.text.toLowerCase().includes(keyword))
    : candidates;

  return (
    <Modal open={open} onClose={onClose} title="문제은행에서 추가" className="max-w-lg">
      <div className="flex flex-col gap-3">
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : (
          <>
            {candidates.length > 5 && (
              <SearchInput value={query} onChange={setQuery} placeholder="문제 본문 검색…" />
            )}
          <div className="flex max-h-[60vh] flex-col divide-y divide-border overflow-y-auto rounded-control border border-border">
            {visible.map((q) => {
              const source = sourceLabel(q, documentNames);
              return (
                <label
                  key={q.id}
                  className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(q.id)}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.includes(q.id) ? prev.filter((v) => v !== q.id) : [...prev, q.id],
                      )
                    }
                    className={`mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)] ${FOCUS_RING}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{q.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <QuestionTypeBadge type={q.type} />
                      <DifficultyBadge difficulty={q.difficulty} />
                      <ReviewStatusBadge status={q.review_status} />
                      {source && <span className="text-xs text-ink-muted">{source}</span>}
                    </div>
                  </div>
                </label>
              );
            })}
            {visible.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-ink-muted">
                {candidates.length === 0
                  ? "추가할 수 있는 문제가 없습니다."
                  : "검색어에 맞는 문제가 없습니다."}
              </p>
            )}
          </div>
          </>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs text-ink-muted">{selected.length}개 선택됨</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button onClick={() => void handleAdd()} disabled={saving || selected.length === 0}>
              {saving ? "추가 중…" : "추가"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SettingsTab({
  book,
  questionCount,
  onSaved,
}: {
  book: QuizBook;
  questionCount: number;
  onSaved: () => Promise<void>;
}) {
  const uid = useId();
  const locked = book.has_sessions;
  const [title, setTitle] = useState(book.title);
  const [description, setDescription] = useState(book.description ?? "");
  const [passingScore, setPassingScore] = useState(book.passing_score);
  const [timeLimit, setTimeLimit] = useState(
    book.time_limit_minutes == null ? "" : String(book.time_limit_minutes),
  );
  const [shuffleQuestions, setShuffleQuestions] = useState(book.shuffle_questions);
  const [shuffleOptions, setShuffleOptions] = useState(book.shuffle_options);
  const [allowRetake, setAllowRetake] = useState(book.allow_retake);
  const [revealAnswers, setRevealAnswers] = useState(book.reveal_answers);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await quizApi.updateBook(book.id, {
        title: title.trim(),
        description: description.trim() || null,
        passing_score: passingScore,
        time_limit_minutes: timeLimit === "" ? null : Number(timeLimit),
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        allow_retake: allowRetake,
        reveal_answers: revealAnswers,
      });
      setSaved(true);
      await onSaved();
    } catch (e) {
      setError(
        quizApi.isQuizLockedError(e)
          ? quizApi.QUIZ_LOCKED_MESSAGE
          : errorMessage(e, "설정을 저장하지 못했습니다."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="문제집 이름" htmlFor={`${uid}-title`}>
          <Input
            id={`${uid}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={locked}
          />
        </Field>
        <Field label="문제 수" htmlFor={`${uid}-count`}>
          <Input id={`${uid}-count`} value={`${questionCount}문제`} disabled />
        </Field>
      </div>

      <Field label="설명" htmlFor={`${uid}-desc`}>
        <Textarea
          id={`${uid}-desc`}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={locked}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="합격 점수" htmlFor={`${uid}-pass`}>
          <Input
            id={`${uid}-pass`}
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
            disabled={locked}
          />
        </Field>
        <Field label="제한 시간(분)" htmlFor={`${uid}-time`}>
          <Input
            id={`${uid}-time`}
            type="number"
            min={1}
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            placeholder="비우면 제한 없음"
            disabled={locked}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <QuizToggleField
          label="문제 순서 랜덤"
          checked={shuffleQuestions}
          onChange={setShuffleQuestions}
          disabled={locked}
        />
        <QuizToggleField
          label="보기 순서 랜덤"
          checked={shuffleOptions}
          onChange={setShuffleOptions}
          disabled={locked}
        />
        <QuizToggleField
          label="재응시 가능"
          checked={allowRetake}
          onChange={setAllowRetake}
          disabled={locked}
        />
        <QuizToggleField
          label="제출 후 정답 공개"
          checked={revealAnswers}
          onChange={setRevealAnswers}
          disabled={locked}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {saved && <span className="text-xs text-ink-muted">저장됐습니다.</span>}
        <Button onClick={() => void handleSave()} disabled={locked || saving || !title.trim()}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>
    </Card>
  );
}

function ResultsTab({ book, currentUserId }: { book: QuizBook; currentUserId: number | null }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    quizApi
      .listBookSessions(book.id)
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "응시 이력을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  const submitted = sessions.filter((s) => s.status === "SUBMITTED" && s.score != null);
  const average = submitted.length
    ? Math.round(submitted.reduce((sum, s) => sum + (s.score ?? 0), 0) / submitted.length)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink-muted">응시 횟수</p>
          <p className="mt-1 text-2xl font-semibold text-ink tnum">{sessions.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">평균 점수</p>
          <p className="mt-1 text-2xl font-semibold text-ink tnum">{average ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">합격 기준</p>
          <p className="mt-1 text-2xl font-semibold text-ink tnum">{book.passing_score}점</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>응시 이력</CardTitle>
          <span className="text-xs text-ink-muted">전체 응시자</span>
        </CardHeader>
        <div className="flex flex-col divide-y divide-border">
          {sessions.map((s) => {
            const mine = currentUserId != null && s.user_id === currentUserId;
            const passed = (s.score ?? 0) >= book.passing_score;
            const body = (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-ink-muted">{formatDateTime(s.created_at)}</span>
                  {mine && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
                      내 응시
                    </span>
                  )}
                  {s.status !== "SUBMITTED" && (
                    <span className="shrink-0 text-xs text-ink-muted">진행 중</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {s.status === "SUBMITTED" ? (
                    <>
                      <span className="text-ink-muted tnum">
                        {s.correct_count}/{s.total_count} 정답
                      </span>
                      <span
                        className={`font-semibold tnum ${passed ? "text-emerald-700" : "text-primary"}`}
                      >
                        {formatScore(s.score)}점
                      </span>
                    </>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </span>
              </>
            );

            return mine && s.status === "SUBMITTED" ? (
              <Link
                key={s.id}
                href={`/quiz/${book.id}/result?session=${s.id}`}
                className={`flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-surface ${FOCUS_RING}`}
              >
                {body}
              </Link>
            ) : (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm"
              >
                {body}
              </div>
            );
          })}
          {!loading && sessions.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              아직 응시 이력이 없습니다.
            </p>
          )}
          {loading && <p className="px-5 py-8 text-center text-sm text-ink-muted">불러오는 중…</p>}
        </div>
      </Card>
    </div>
  );
}
