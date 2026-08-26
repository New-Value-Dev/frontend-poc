"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  BackLink,
  Card,
  CardHeader,
  CardTitle,
  Button,
  ErrorBanner,
  Field,
  Input,
  Textarea,
  DifficultyBadge,
  FOCUS_RING,
} from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { useAuth } from "@/components/auth/AuthProvider";
import { errorMessage, isAuthError } from "@/lib/api";
import { listDocuments } from "@/lib/documents";
import * as quizApi from "@/lib/quiz";
import type {
  Document,
  Project,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionType,
  QuizReviewStatus,
} from "@/lib/types";
import { ALL_PROJECTS, QuizProjectGate, useQuizProject } from "./QuizProjectProvider";
import { QuizPageShell } from "./QuizPageShell";

const EMPTY_OPTIONS = ["", "", "", ""];

export function QuestionEditorView({
  questionId,
  bookId,
}: {
  questionId?: string;
  bookId?: string;
}) {
  return (
    <QuizPageShell>
      <QuizProjectGate>
        <Resolver questionId={questionId} bookId={bookId} />
      </QuizProjectGate>
    </QuizPageShell>
  );
}

function Resolver({ questionId, bookId }: { questionId?: string; bookId?: string }) {
  const { loading: authLoading } = useAuth();
  const { projects, projectId: filterProjectId, scopeIds } = useQuizProject();
  const [projectId, setProjectId] = useState(
    filterProjectId !== ALL_PROJECTS ? filterProjectId : String(projects[0]?.id ?? ""),
  );
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(null);
  const [initial, setInitial] = useState<QuizQuestion | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
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
        // 단일 문제 조회 엔드포인트가 없어, 수정 대상은 목록에서 찾는다.
        if (questionId) {
          const lists = bookId
            ? [await quizApi.listBookQuestions(bookId)]
            : await Promise.all(scopeIds.map((pid) => quizApi.listQuestions(pid)));
          const found = lists.flat().find((q) => String(q.id) === questionId);
          if (cancelled) return;
          if (!found) {
            setError("문제를 찾을 수 없습니다.");
            return;
          }
          setInitial(found);
          setResolvedProjectId(String(found.project_id));
          const docs = await listDocuments(String(found.project_id)).catch(() => [] as Document[]);
          if (!cancelled) setDocuments(docs);
          return;
        }

        // 새로 작성: 문제집에서 왔으면 그 문제집의 프로젝트, 아니면 폼에서 고른 프로젝트.
        const pid = bookId ? String((await quizApi.getBook(bookId)).project_id) : projectId;
        if (cancelled || !pid) return;
        setResolvedProjectId(pid);
        const docs = await listDocuments(pid).catch(() => [] as Document[]);
        if (!cancelled) setDocuments(docs);
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e, "문제를 불러오지 못했습니다."));
        setNeedLogin(isAuthError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, projectId, bookId, questionId, scopeIds]);

  const backHref = bookId ? `/quiz/${bookId}` : "/quiz/bank";

  if (authLoading || loading) return null;

  if (error || resolvedProjectId == null || (questionId && !initial)) {
    return (
      <>
        <BackLink href={backHref}>{bookId ? "문제집" : "문제은행"}</BackLink>
        <ErrorBanner message={error ?? "문제를 불러오지 못했습니다."} needLogin={needLogin} />
      </>
    );
  }

  return (
    <QuestionForm
      projectId={resolvedProjectId}
      documents={documents}
      initial={initial ?? undefined}
      bookId={bookId}
      backHref={backHref}
      // 새 문제를 문제집 밖에서 만들 때만 소속 프로젝트를 고를 수 있다.
      projectChooser={
        !initial && !bookId && projects.length > 1
          ? { projects, value: projectId, onChange: setProjectId }
          : undefined
      }
    />
  );
}

function QuestionForm({
  projectId,
  documents,
  initial,
  bookId,
  backHref,
  projectChooser,
}: {
  projectId: string;
  documents: Document[];
  initial?: QuizQuestion;
  bookId?: string;
  backHref: string;
  projectChooser?: { projects: Project[]; value: string; onChange: (id: string) => void };
}) {
  const uid = useId();
  const router = useRouter();
  const [type, setType] = useState<QuizQuestionType>(
    (initial?.type as QuizQuestionType) ?? "SINGLE_CHOICE",
  );
  const [text, setText] = useState(initial?.text ?? "");
  const [options, setOptions] = useState<string[]>(initial?.options ?? EMPTY_OPTIONS);
  const [correctIndex, setCorrectIndex] = useState(
    initial?.type === "SINGLE_CHOICE" ? Number(initial.correct_answer) : 0,
  );
  const [correctBool, setCorrectBool] = useState<"O" | "X">(
    initial?.type === "TRUE_FALSE" ? (initial.correct_answer as "O" | "X") : "O",
  );
  const [correctText, setCorrectText] = useState(
    initial?.type === "SHORT_ANSWER" ? initial.correct_answer : "",
  );
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(
    (initial?.difficulty as QuizDifficulty) ?? "MEDIUM",
  );
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [sourceDocumentId, setSourceDocumentId] = useState(
    initial?.source_document_id != null ? String(initial.source_document_id) : "",
  );
  const [sourceLocation, setSourceLocation] = useState(initial?.source_location ?? "");
  const [reviewStatus, setReviewStatus] = useState<QuizReviewStatus>(
    (initial?.review_status as QuizReviewStatus) ?? "DRAFT",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledOptions = options.map((o) => o.trim()).filter(Boolean);
  const correctAnswer =
    type === "SINGLE_CHOICE"
      ? String(correctIndex)
      : type === "TRUE_FALSE"
        ? correctBool
        : correctText.trim();

  const invalid =
    !text.trim() ||
    (type === "SINGLE_CHOICE" && (filledOptions.length < 2 || !options[correctIndex]?.trim())) ||
    (type === "SHORT_ANSWER" && !correctAnswer);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError(null);

    const payload = {
      type,
      text: text.trim(),
      options: type === "SINGLE_CHOICE" ? options.map((o) => o.trim()) : null,
      correct_answer: correctAnswer,
      explanation: explanation.trim(),
      difficulty,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      source_document_id: sourceDocumentId === "" ? null : Number(sourceDocumentId),
      source_location: sourceLocation.trim() || null,
    };

    try {
      if (initial) {
        await quizApi.updateQuestion(initial.id, { ...payload, review_status: reviewStatus });
      } else {
        const created = await quizApi.createQuestion(projectId, payload);
        if (bookId) {
          try {
            await quizApi.addBookQuestions(bookId, [created.id]);
          } catch (e) {
            setError(
              quizApi.isQuizLockedError(e)
                ? `문제는 문제은행에 저장됐지만 ${quizApi.QUIZ_LOCKED_MESSAGE}`
                : errorMessage(e, "문제는 저장됐지만 문제집에 추가하지 못했습니다."),
            );
            setSaving(false);
            return;
          }
        }
      }
      router.push(backHref);
    } catch (err) {
      setError(errorMessage(err, "문제를 저장하지 못했습니다."));
      setSaving(false);
    }
  }

  return (
    <>
      <BackLink href={backHref}>{bookId ? "문제집" : "문제은행"}</BackLink>

      <PageHeader
        title={initial ? "문제 수정" : "문제 작성"}
        description={
          bookId && !initial
            ? "저장하면 문제은행에 등록되고 이 문제집에 함께 추가됩니다."
            : "문제은행에 등록됩니다. 여러 문제집이 같은 문항을 함께 쓸 수 있습니다."
        }
      />

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-end gap-4">
            {projectChooser && (
              <div className="w-52">
                <p className="mb-1.5 text-xs font-medium text-ink">프로젝트</p>
                <Dropdown
                  label="프로젝트"
                  value={projectChooser.value}
                  onChange={projectChooser.onChange}
                  options={projectChooser.projects.map((p) => ({
                    value: String(p.id),
                    label: p.name,
                  }))}
                />
              </div>
            )}
            <div className="w-40">
              <p className="mb-1.5 text-xs font-medium text-ink">문제 유형</p>
              <Dropdown
                label="문제 유형"
                value={type}
                onChange={(v) => setType(v as QuizQuestionType)}
                options={[
                  { value: "SINGLE_CHOICE", label: "객관식" },
                  { value: "TRUE_FALSE", label: "O/X" },
                  { value: "SHORT_ANSWER", label: "단답형" },
                ]}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink">난이도</p>
              <div className="flex gap-1.5">
                {(["EASY", "MEDIUM", "HARD"] as QuizDifficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    aria-pressed={difficulty === d}
                    className={`rounded-control px-1 py-1 transition-opacity ${FOCUS_RING} ${
                      difficulty === d ? "" : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    <DifficultyBadge difficulty={d} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field label="질문" htmlFor={`${uid}-text`}>
            <Textarea
              id={`${uid}-text`}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 개인정보 파기 시점에 대한 설명으로 올바른 것은?"
              autoFocus
            />
          </Field>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>정답</CardTitle>
            {type === "SINGLE_CHOICE" && (
              <span className="text-xs text-ink-muted">정답인 보기를 선택하세요 (최소 2개 작성)</span>
            )}
          </CardHeader>
          <div className="flex flex-col gap-3 p-5">
            {type === "SINGLE_CHOICE" &&
              options.map((opt, i) => (
                <label key={i} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`${uid}-correct`}
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    aria-label={`보기 ${i + 1}을 정답으로`}
                    className={`h-4 w-4 shrink-0 accent-[var(--color-primary)] ${FOCUS_RING}`}
                  />
                  <Input
                    value={opt}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((o, oi) => (oi === i ? e.target.value : o)))
                    }
                    placeholder={`보기 ${i + 1}`}
                  />
                </label>
              ))}

            {type === "TRUE_FALSE" && (
              <div className="flex gap-2">
                {(["O", "X"] as const).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={correctBool === v ? "primary" : "outline"}
                    onClick={() => setCorrectBool(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            )}

            {type === "SHORT_ANSWER" && (
              <Field label="정답 텍스트" htmlFor={`${uid}-answer`}>
                <Input
                  id={`${uid}-answer`}
                  value={correctText}
                  onChange={(e) => setCorrectText(e.target.value)}
                  placeholder="채점 시 대소문자와 앞뒤 공백은 무시됩니다"
                />
              </Field>
            )}

            <Field label="해설" htmlFor={`${uid}-explanation`}>
              <Textarea
                id={`${uid}-explanation`}
                rows={3}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="오답노트와 학습 모드에서 보여줄 설명"
              />
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>분류 · 출처</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="태그 (쉼표로 구분)" htmlFor={`${uid}-tags`}>
              <Input
                id={`${uid}-tags`}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="예: 개인정보, 파기"
              />
            </Field>

            <div>
              <p className="mb-1.5 text-xs font-medium text-ink">검수 상태</p>
              {initial ? (
                <Dropdown
                  label="검수 상태"
                  value={reviewStatus}
                  onChange={(v) => setReviewStatus(v as QuizReviewStatus)}
                  options={[
                    { value: "DRAFT", label: "검수 전" },
                    { value: "REVIEWED", label: "검수 중" },
                    { value: "APPROVED", label: "검수 완료" },
                  ]}
                />
              ) : (
                <p className="py-2 text-sm text-ink-muted">
                  새 문제는 &quot;검수 전&quot;으로 저장됩니다.
                </p>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-ink">출처 문서</p>
              <Dropdown
                label="출처 문서"
                value={sourceDocumentId}
                onChange={setSourceDocumentId}
                options={[
                  { value: "", label: "선택 없음" },
                  ...documents.map((d) => ({ value: String(d.id), label: d.name })),
                ]}
                searchPlaceholder="문서 이름 검색…"
                emptyLabel="이름이 맞는 문서가 없습니다."
              />
            </div>

            <Field label="출처 위치" htmlFor={`${uid}-location`}>
              <Input
                id={`${uid}-location`}
                value={sourceLocation}
                onChange={(e) => setSourceLocation(e.target.value)}
                placeholder="예: 제14조"
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push(backHref)}>
            취소
          </Button>
          <Button type="submit" disabled={saving || invalid}>
            {saving ? "저장 중…" : initial ? "저장" : "문제 추가"}
          </Button>
        </div>
      </form>
    </>
  );
}
