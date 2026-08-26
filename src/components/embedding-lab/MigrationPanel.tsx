"use client";

import { useEffect, useState } from "react";
import { migrate } from "@/lib/embedding";
import { listProjects } from "@/lib/projects";
import { listDocuments } from "@/lib/documents";
import { errorMessage } from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  ErrorBanner,
  Field,
  Select,
  StatusBadge,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { JobProgress } from "./JobProgress";
import type { Document, EmbeddingJob, Project } from "@/lib/types";

export function MigrationPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [forceSemantic, setForceSemantic] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobRunning, setJobRunning] = useState(false);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
    if (!projectId) {
      setDocuments([]);
      return;
    }
    let cancelled = false;
    setLoadingDocs(true);
    listDocuments(projectId)
      .then((docs) => {
        if (!cancelled) setDocuments(docs.filter((d) => d.current_version != null));
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "문서 목록을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoadingDocs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function toggle(versionId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) next.delete(versionId);
      else next.add(versionId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === documents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(documents.map((d) => d.current_version!.id)));
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const job = await migrate({ document_version_ids: [...selected], force_semantic: forceSemantic });
      setJobId(job.id);
      setJobRunning(true);
      setConfirmOpen(false);
      setSelected(new Set());
    } catch (e) {
      setError(errorMessage(e, "마이그레이션 시작에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader>
          <CardTitle>기존 문서 마이그레이션</CardTitle>
          <span className="text-xs text-ink-muted">선택한 문서를 현재 활성 설정으로 재청킹 + 재임베딩</span>
        </CardHeader>
        <div className="flex flex-col gap-4 p-5">
          <Field label="프로젝트" htmlFor="mg-project">
            <Select id="mg-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">선택하세요</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          {projectId && (
            <div className="overflow-hidden rounded-control border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] whitespace-nowrap text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface text-left text-xs text-ink-muted">
                      <th className="w-10 px-4 py-2.5">
                        {documents.length > 0 && (
                          <input
                            type="checkbox"
                            checked={selected.size === documents.length}
                            onChange={toggleAll}
                            aria-label="전체 선택"
                          />
                        )}
                      </th>
                      <th className="px-2 py-2.5 font-medium">문서</th>
                      <th className="px-2 py-2.5 font-medium">버전</th>
                      <th className="px-2 py-2.5 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.map((d) => (
                      <tr key={d.id} className="hover:bg-surface">
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(d.current_version!.id)}
                            onChange={() => toggle(d.current_version!.id)}
                            aria-label={d.name}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-ink">{d.name}</td>
                        <td className="px-2 py-2.5 text-ink-muted">v{d.current_version!.version_no}</td>
                        <td className="px-2 py-2.5">
                          <StatusBadge status={d.current_version!.processing_status} />
                        </td>
                      </tr>
                    ))}
                    {!loadingDocs && documents.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-muted">
                          버전이 있는 문서가 없습니다.
                        </td>
                      </tr>
                    )}
                    {loadingDocs && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-muted">
                          불러오는 중…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <label className="flex w-fit items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={forceSemantic} onChange={(e) => setForceSemantic(e.target.checked)} />
            semantic 청킹 강제 적용
          </label>

          <div>
            <Button onClick={() => setConfirmOpen(true)} disabled={selected.size === 0 || jobRunning}>
              마이그레이션 실행 {selected.size > 0 ? `(${selected.size}건)` : ""}
            </Button>
          </div>

          {jobId != null && (
            <JobProgress
              jobId={jobId}
              onDone={(job: EmbeddingJob) => {
                setJobRunning(false);
                if (job.status === "COMPLETED" && projectId) {
                  listDocuments(projectId)
                    .then((docs) => setDocuments(docs.filter((d) => d.current_version != null)))
                    .catch(() => {});
                }
              }}
            />
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="마이그레이션 실행"
        message={`선택한 문서 ${selected.size}건을 재청킹 + 재임베딩합니다. 문서 수에 따라 시간이 오래 걸릴 수 있어요. 계속할까요?`}
        confirmLabel="실행"
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
