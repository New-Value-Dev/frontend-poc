"use client";

import { useEffect, useState } from "react";
import { listModels, activateModel, reembedModel } from "@/lib/embedding";
import { errorMessage } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  EmbeddingModelStatusBadge,
  ErrorBanner,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { JobProgress } from "./JobProgress";
import type { EmbeddingModel } from "@/lib/types";

export function ModelsPanel() {
  const [models, setModels] = useState<EmbeddingModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [reembedTarget, setReembedTarget] = useState<EmbeddingModel | null>(null);
  const [reembedBusy, setReembedBusy] = useState(false);
  const [reembedJobs, setReembedJobs] = useState<Record<number, number>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setModels(await listModels());
    } catch (e) {
      setError(errorMessage(e, "모델 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function handleActivate(model: EmbeddingModel) {
    setActivatingId(model.id);
    try {
      await activateModel(model.id);
      await load();
    } catch (e) {
      setError(errorMessage(e, "모델 활성화에 실패했습니다."));
    } finally {
      setActivatingId(null);
    }
  }

  async function handleReembedConfirm() {
    if (!reembedTarget) return;
    setReembedBusy(true);
    try {
      const job = await reembedModel(reembedTarget.id);
      setReembedJobs((prev) => ({ ...prev, [reembedTarget.id]: job.id }));
      setReembedTarget(null);
    } catch (e) {
      setError(errorMessage(e, "재임베딩 시작에 실패했습니다."));
    } finally {
      setReembedBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Embedding Models</CardTitle>
          <span className="text-xs text-ink-muted">등록된 로컬 임베딩 모델</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted">
                <th className="px-5 py-3 font-medium">Model</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Dimension</th>
                <th className="px-5 py-3 font-medium">Max Tokens</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading &&
                models.map((m) => (
                  <tr key={m.id} className="hover:bg-surface">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{m.model_name}</div>
                      <div className="text-xs text-ink-muted">
                        {m.model_key}
                        {m.model_version ? ` · ${m.model_version}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <EmbeddingModelStatusBadge status={m.status} />
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{m.dimension}</td>
                    <td className="px-5 py-3 text-ink-muted">{m.max_tokens ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {m.is_active ? (
                          <span className="text-xs text-ink-muted">활성</span>
                        ) : (
                          <button
                            type="button"
                            disabled={activatingId === m.id}
                            onClick={() => void handleActivate(m)}
                            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                          >
                            {activatingId === m.id ? "활성화 중…" : "활성화"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setReembedTarget(m)}
                          disabled={reembedTarget?.id === m.id || reembedJobs[m.id] != null}
                          className="text-xs font-medium text-ink-muted hover:text-ink hover:underline disabled:opacity-50"
                        >
                          재임베딩
                        </button>
                      </div>
                      {reembedJobs[m.id] != null && (
                        <div className="mt-2 w-72">
                          <JobProgress
                            jobId={reembedJobs[m.id]}
                            onDone={() => {
                              void load();
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              {!loading && models.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-muted">
                    등록된 임베딩 모델이 없습니다.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-muted">
                    불러오는 중…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={reembedTarget != null}
        title="전체 재임베딩"
        message={`청킹은 그대로 두고 "${reembedTarget?.model_name}" 모델로 모든 document_chunks를 재임베딩합니다. 문서 수에 따라 시간이 걸릴 수 있어요. 계속할까요?`}
        confirmLabel="재임베딩 시작"
        busy={reembedBusy}
        onConfirm={() => void handleReembedConfirm()}
        onCancel={() => setReembedTarget(null)}
      />
    </div>
  );
}
