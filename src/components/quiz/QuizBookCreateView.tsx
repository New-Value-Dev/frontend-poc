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
  InfoTooltip,
  Textarea,
  FOCUS_RING,
} from "@/components/ui/primitives";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Dropdown } from "@/components/ui/Dropdown";
import { SearchInput } from "@/components/ui/FilterBar";
import { errorMessage } from "@/lib/api";
import { listDocuments } from "@/lib/documents";
import { listProjectMembers } from "@/lib/projects";
import * as quizApi from "@/lib/quiz";
import type { Document, ProjectMember } from "@/lib/types";
import { ALL_PROJECTS, QuizProjectGate, useQuizProject } from "./QuizProjectProvider";
import { QuizPageShell } from "./QuizPageShell";
import {
  AssigneePicker,
  AssigneeSearchPicker,
  LockNotice,
  QuizToggleField,
  type SelectedAssignee,
} from "./QuizFields";
import { fromDatetimeLocalInput } from "./quizFormat";

export function QuizBookCreateView() {
  return (
    <QuizPageShell>
      <QuizProjectGate>
        <CreateForm />
      </QuizProjectGate>
    </QuizPageShell>
  );
}

function CreateForm() {
  const uid = useId();
  const router = useRouter();
  const { projects, projectId: filterProjectId } = useQuizProject();
  const [projectId, setProjectId] = useState(
    filterProjectId !== ALL_PROJECTS ? filterProjectId : String(projects[0]?.id ?? ""),
  );
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docQuery, setDocQuery] = useState("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceIds, setSourceIds] = useState<number[]>([]);
  const [assignees, setAssignees] = useState<SelectedAssignee[]>([]);
  const assigneeIds = assignees.map((a) => a.user_id);
  const isPublicProject = projects.find((p) => String(p.id) === projectId)?.visibility === "public";
  const [dueAt, setDueAt] = useState("");
  const [passingScore, setPassingScore] = useState(60);
  const [timeLimit, setTimeLimit] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [allowRetake, setAllowRetake] = useState(true);
  const [revealAnswers, setRevealAnswers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignees([]);
    listProjectMembers(projectId)
      .then((list) => {
        if (!cancelled) setMembers(list.filter((m) => m.status === "active"));
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await quizApi.createBook(projectId, {
        title: title.trim(),
        description: description.trim() || null,
        source_document_ids: sourceIds,
        passing_score: passingScore,
        time_limit_minutes: timeLimit === "" ? null : Number(timeLimit),
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        allow_retake: allowRetake,
        reveal_answers: revealAnswers,
        due_at: fromDatetimeLocalInput(dueAt),
        assignee_user_ids: assigneeIds,
      });
      router.push(`/quiz/${created.id}`);
    } catch (err) {
      setError(errorMessage(err, "문제집을 만들지 못했습니다."));
      setSaving(false);
    }
  }

  const docKeyword = docQuery.trim().toLowerCase();
  const visibleDocuments = docKeyword
    ? documents.filter((d) => d.name.toLowerCase().includes(docKeyword))
    : documents;

  return (
    <>
      <BackLink href="/quiz">문제집 목록</BackLink>

      <PageHeader
        title="새 문제집"
        description="만든 뒤 문제은행에서 문항을 편입하거나 직접 작성해 채웁니다."
      />

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 p-5">
          {projects.length > 1 && (
            <div className="w-full sm:w-64">
              <p className="mb-1.5 text-xs font-medium text-ink">프로젝트</p>
              <Dropdown
                label="프로젝트"
                value={projectId}
                onChange={setProjectId}
                options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
              />
            </div>
          )}

          <Field label="문제집 이름" htmlFor={`${uid}-title`}>
            <Input
              id={`${uid}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 개인정보보호 기본교육"
              autoFocus
            />
          </Field>

          <Field label="설명" htmlFor={`${uid}-desc`}>
            <Textarea
              id={`${uid}-desc`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 신입사원 개인정보보호 교육용"
            />
          </Field>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-1.5">
                <CardTitle>출제 범위</CardTitle>
                <InfoTooltip text="문제은행에서 문항을 고를 때 기본 필터로 쓰입니다. 비워 두면 전체 문서가 대상입니다." />
              </div>
              <span className="text-xs text-ink-muted">
                {sourceIds.length > 0 ? `${sourceIds.length}개 선택` : "선택"}
              </span>
            </CardHeader>
            <div className="flex flex-col gap-2.5 p-5">
              {documents.length > 8 && (
                <SearchInput
                  value={docQuery}
                  onChange={setDocQuery}
                  placeholder="문서 이름 검색…"
                />
              )}
              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                {visibleDocuments.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex cursor-pointer items-start gap-2 rounded-control px-1.5 py-1.5 text-sm text-ink hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={sourceIds.includes(doc.id)}
                      onChange={() =>
                        setSourceIds((prev) =>
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
                  <p className="text-xs text-ink-muted">이 프로젝트에 등록된 문서가 없습니다.</p>
                )}
                {documents.length > 0 && visibleDocuments.length === 0 && (
                  <p className="text-xs text-ink-muted">이름이 맞는 문서가 없습니다.</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>응시 설정</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="합격 점수" htmlFor={`${uid}-pass`}>
                  <Input
                    id={`${uid}-pass`}
                    type="number"
                    min={0}
                    max={100}
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
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
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-1">
                <QuizToggleField
                  label="문제 순서 랜덤"
                  checked={shuffleQuestions}
                  onChange={setShuffleQuestions}
                />
                <QuizToggleField
                  label="보기 순서 랜덤"
                  checked={shuffleOptions}
                  onChange={setShuffleOptions}
                />
                <QuizToggleField
                  label="재응시 가능"
                  checked={allowRetake}
                  onChange={setAllowRetake}
                />
                <QuizToggleField
                  label="제출 후 정답 공개"
                  checked={revealAnswers}
                  onChange={setRevealAnswers}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <CardTitle>응시자 지정</CardTitle>
              <InfoTooltip text="지정한 사람에게 즉시 알림이 발송되고, 마감기한이 임박하면 아직 응시하지 않은 지정자에게 리마인더가 갑니다. 비워 두면 프로젝트 멤버 누구나 자유롭게 응시할 수 있습니다." />
            </div>
            <span className="text-xs text-ink-muted">
              {assigneeIds.length > 0 ? `${assigneeIds.length}명 선택` : "선택 안 함"}
            </span>
          </CardHeader>
          <div className="flex flex-col gap-4 p-5">
            <Field label="마감기한" htmlFor={`${uid}-due`}>
              <DateTimePicker id={`${uid}-due`} value={dueAt} onChange={setDueAt} />
            </Field>
            {isPublicProject ? (
              <AssigneeSearchPicker
                selected={assignees}
                onAdd={(user) => setAssignees((prev) => [...prev, user])}
                onRemove={(userId) =>
                  setAssignees((prev) => prev.filter((a) => a.user_id !== userId))
                }
              />
            ) : (
              <AssigneePicker
                members={members}
                selectedUserIds={assigneeIds}
                onToggle={(member) =>
                  setAssignees((prev) =>
                    prev.some((a) => a.user_id === member.user_id)
                      ? prev.filter((a) => a.user_id !== member.user_id)
                      : [...prev, { user_id: member.user_id, name: member.name, email: member.email }],
                  )
                }
                query={memberQuery}
                onQueryChange={setMemberQuery}
              />
            )}
          </div>
        </Card>

        <LockNotice />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/quiz")}>
            취소
          </Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? "만드는 중…" : "문제집 만들기"}
          </Button>
        </div>
      </form>
    </>
  );
}
