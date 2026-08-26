"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  Button,
  ErrorBanner,
  Field,
  FOCUS_RING,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { createDataset } from "@/lib/embedding";
import { listProjects } from "@/lib/projects";
import { listDocuments } from "@/lib/documents";
import { errorMessage } from "@/lib/api";
import type { BenchmarkDataset, BenchmarkQuestionCreate, Document, Project } from "@/lib/types";

type DraftGroundTruth = { document_id: string; expected_snippet: string; page_start: string };
type DraftQuestion = { question: string; category: string; groundTruth: DraftGroundTruth[] };

function emptyGroundTruth(): DraftGroundTruth {
  return { document_id: "", expected_snippet: "", page_start: "" };
}

function emptyQuestion(): DraftQuestion {
  return { question: "", category: "", groundTruth: [emptyGroundTruth()] };
}

export function DatasetModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (dataset: BenchmarkDataset) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName("");
    setDescription("");
    setProjectId("");
    setDocuments([]);
    setQuestions([emptyQuestion()]);
    setError(null);
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [open]);

  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDocuments([]);
      return;
    }
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

  function updateQuestion(qi: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }

  function updateGroundTruth(qi: number, gi: number, patch: Partial<DraftGroundTruth>) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, groundTruth: q.groundTruth.map((g, j) => (j === gi ? { ...g, ...patch } : g)) }
          : q,
      ),
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(qi: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  }

  function addGroundTruth(qi: number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, groundTruth: [...q.groundTruth, emptyGroundTruth()] } : q)),
    );
  }

  function removeGroundTruth(qi: number, gi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi ? { ...q, groundTruth: q.groundTruth.filter((_, j) => j !== gi) } : q,
      ),
    );
  }

  function buildPayload(): BenchmarkQuestionCreate[] | null {
    const built: BenchmarkQuestionCreate[] = [];
    for (const q of questions) {
      if (!q.question.trim()) return null;
      const groundTruth = q.groundTruth
        .filter((g) => g.document_id.trim() && g.expected_snippet.trim())
        .map((g) => ({
          document_id: Number(g.document_id),
          expected_snippet: g.expected_snippet.trim(),
          ...(g.page_start.trim() ? { page_start: Number(g.page_start) } : {}),
        }));
      if (groundTruth.length === 0) return null;
      built.push({
        question: q.question.trim(),
        category: q.category.trim() || undefined,
        ground_truth: groundTruth,
      });
    }
    return built.length > 0 ? built : null;
  }

  const payloadPreview = buildPayload();
  const canSubmit = name.trim().length > 0 && payloadPreview != null;

  async function handleSubmit() {
    const payload = buildPayload();
    if (!name.trim() || !payload) return;
    setBusy(true);
    setError(null);
    try {
      const dataset = await createDataset({
        name: name.trim(),
        description: description.trim() || undefined,
        project_id: projectId ? Number(projectId) : undefined,
        questions: payload,
      });
      onCreated(dataset);
    } catch (e) {
      setError(errorMessage(e, "데이터셋 생성에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="벤치마크 데이터셋 만들기" className="max-w-2xl">
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="이름" htmlFor="ds-name">
            <Input id="ds-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 계약서 검색 벤치마크" />
          </Field>
          <Field label="프로젝트 (선택)" htmlFor="ds-project" hint="지정하면 ground truth 문서를 목록에서 고를 수 있어요.">
            <Select id="ds-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">전체</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="설명 (선택)" htmlFor="ds-desc">
          <Textarea id="ds-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink">질문</span>
            <button type="button" onClick={addQuestion} className={`text-xs font-medium text-primary hover:underline ${FOCUS_RING} rounded-sm`}>
              + 질문 추가
            </button>
          </div>

          {questions.map((q, qi) => (
            <div key={qi} className="rounded-control border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Textarea
                    value={q.question}
                    onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                    placeholder="질문 텍스트"
                    rows={2}
                  />
                </div>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qi)}
                    className={`shrink-0 rounded-sm text-xs text-ink-muted hover:text-primary ${FOCUS_RING}`}
                  >
                    삭제
                  </button>
                )}
              </div>
              <Input
                className="mt-2"
                value={q.category}
                onChange={(e) => updateQuestion(qi, { category: e.target.value })}
                placeholder="카테고리 (선택)"
              />

              <div className="mt-3 flex flex-col gap-2">
                <span className="text-xs text-ink-muted">Ground truth 스니펫</span>
                {q.groundTruth.map((g, gi) => (
                  <div key={gi} className="flex flex-wrap items-center gap-2 rounded-control bg-surface p-2">
                    {documents.length > 0 ? (
                      <Select
                        className="w-48"
                        value={g.document_id}
                        onChange={(e) => updateGroundTruth(qi, gi, { document_id: e.target.value })}
                      >
                        <option value="">문서 선택</option>
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        className="w-32"
                        type="number"
                        value={g.document_id}
                        onChange={(e) => updateGroundTruth(qi, gi, { document_id: e.target.value })}
                        placeholder="document_id"
                      />
                    )}
                    <Input
                      className="min-w-[12rem] flex-1"
                      value={g.expected_snippet}
                      onChange={(e) => updateGroundTruth(qi, gi, { expected_snippet: e.target.value })}
                      placeholder="기대 스니펫"
                    />
                    <Input
                      className="w-24"
                      type="number"
                      value={g.page_start}
                      onChange={(e) => updateGroundTruth(qi, gi, { page_start: e.target.value })}
                      placeholder="페이지"
                    />
                    {q.groundTruth.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGroundTruth(qi, gi)}
                        className={`text-xs text-ink-muted hover:text-primary ${FOCUS_RING} rounded-sm`}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addGroundTruth(qi)}
                  className={`self-start text-xs text-ink-muted hover:text-ink hover:underline ${FOCUS_RING} rounded-sm`}
                >
                  + 스니펫 추가
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button onClick={() => void handleSubmit()} disabled={!canSubmit || busy}>
          {busy ? "생성 중…" : "데이터셋 생성"}
        </Button>
      </div>
    </Modal>
  );
}
