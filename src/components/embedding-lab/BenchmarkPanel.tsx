"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listModels,
  listDatasets,
  listBenchmarks,
  runBenchmark,
  getBenchmark,
  applyBenchmark,
} from "@/lib/embedding";
import { errorMessage } from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmbeddingJobStatusBadge,
  ErrorBanner,
  Field,
  Input,
  Select,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { DatasetModal } from "./DatasetModal";
import type { BenchmarkDataset, BenchmarkRun, EmbeddingModel } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 200; // 10분

const STRATEGY_OPTIONS = [
  { value: "", label: "활성 설정 사용" },
  { value: "structure", label: "structure" },
  { value: "semantic", label: "semantic" },
];

function fmt(n: number | null, digits = 3): string {
  return n == null ? "—" : n.toFixed(digits);
}

export function BenchmarkPanel() {
  const [models, setModels] = useState<EmbeddingModel[]>([]);
  const [datasets, setDatasets] = useState<BenchmarkDataset[]>([]);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [datasetId, setDatasetId] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<Set<number>>(new Set());
  const [strategy, setStrategy] = useState("");
  const [chunkMaxChars, setChunkMaxChars] = useState("");
  const [chunkOverlapChars, setChunkOverlapChars] = useState("");
  const [sentenceWindow, setSentenceWindow] = useState("");
  const [breakpointPercentile, setBreakpointPercentile] = useState("");

  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<{ runId: number; modelId: number; modelName: string } | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  const modelName = useMemo(() => {
    const map = new Map(models.map((m) => [m.id, m.model_name]));
    return (id: number) => map.get(id) ?? `모델 #${id}`;
  }, [models]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [m, d, r] = await Promise.all([listModels(), listDatasets(), listBenchmarks()]);
      setModels(m);
      setDatasets(d);
      setRuns([...r].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)));
    } catch (e) {
      setError(errorMessage(e, "벤치마크 정보를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, []);

  function toggleModel(id: number) {
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pollRun(runId: number) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      let run: BenchmarkRun;
      try {
        run = await getBenchmark(runId);
      } catch {
        continue;
      }
      setRuns((prev) => {
        const rest = prev.filter((r) => r.id !== run.id);
        return [run, ...rest].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      });
      if (run.status === "COMPLETED" || run.status === "FAILED") {
        setActiveRunId(null);
        return;
      }
    }
    setActiveRunId(null);
    setError("벤치마크 진행 상황 조회가 시간 초과되었습니다. 새로고침해 확인해 주세요.");
  }

  async function handleRun() {
    if (!datasetId || selectedModelIds.size === 0) return;
    setRunning(true);
    setError(null);
    setAppliedMsg(null);
    try {
      const chunking_config =
        strategy || chunkMaxChars || chunkOverlapChars || sentenceWindow || breakpointPercentile
          ? {
              ...(strategy ? { strategy: strategy as "structure" | "semantic" } : {}),
              ...(chunkMaxChars ? { chunk_max_chars: Number(chunkMaxChars) } : {}),
              ...(chunkOverlapChars ? { chunk_overlap_chars: Number(chunkOverlapChars) } : {}),
              ...(sentenceWindow ? { sentence_window: Number(sentenceWindow) } : {}),
              ...(breakpointPercentile ? { breakpoint_percentile: Number(breakpointPercentile) } : {}),
            }
          : undefined;
      const { run_id } = await runBenchmark({
        dataset_id: Number(datasetId),
        model_ids: [...selectedModelIds],
        chunking_config,
      });
      setActiveRunId(run_id);
      await loadAll();
      void pollRun(run_id);
    } catch (e) {
      setError(errorMessage(e, "벤치마크 실행에 실패했습니다."));
    } finally {
      setRunning(false);
    }
  }

  async function handleApplyConfirm() {
    if (!applyTarget) return;
    setApplyBusy(true);
    try {
      await applyBenchmark(applyTarget.runId, applyTarget.modelId);
      setAppliedMsg(`"${applyTarget.modelName}" 조합을 운영에 적용했어요. 기존 문서 재처리는 별도로 마이그레이션에서 실행해야 해요.`);
      setApplyTarget(null);
    } catch (e) {
      setError(errorMessage(e, "운영 적용에 실패했습니다."));
    } finally {
      setApplyBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}
      {appliedMsg && (
        <div className="rounded-panel border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {appliedMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>벤치마크 실행</CardTitle>
          <button
            type="button"
            onClick={() => setDatasetModalOpen(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            + 데이터셋 만들기
          </button>
        </CardHeader>
        <div className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="데이터셋" htmlFor="bm-dataset">
              <Select id="bm-dataset" value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                <option value="">선택하세요</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.question_count}문항)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="비교할 모델" htmlFor="bm-models">
              <div id="bm-models" className="flex flex-wrap gap-2">
                {models.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-1.5 rounded-control border border-border px-2.5 py-1.5 text-xs text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModelIds.has(m.id)}
                      onChange={() => toggleModel(m.id)}
                    />
                    {m.model_name}
                  </label>
                ))}
                {models.length === 0 && <span className="text-xs text-ink-muted">등록된 모델이 없습니다.</span>}
              </div>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink">
              청킹 파라미터 override <span className="font-normal text-ink-muted">(생략 시 활성 설정 사용)</span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="전략" htmlFor="ck-strategy">
                <Select id="ck-strategy" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                  {STRATEGY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="chunk 크기" htmlFor="ck-max">
                <Input id="ck-max" type="number" value={chunkMaxChars} onChange={(e) => setChunkMaxChars(e.target.value)} />
              </Field>
              <Field label="overlap" htmlFor="ck-overlap">
                <Input id="ck-overlap" type="number" value={chunkOverlapChars} onChange={(e) => setChunkOverlapChars(e.target.value)} />
              </Field>
              <Field label="문장 윈도우" htmlFor="ck-window">
                <Input id="ck-window" type="number" value={sentenceWindow} onChange={(e) => setSentenceWindow(e.target.value)} />
              </Field>
              <Field label="breakpoint 백분위" htmlFor="ck-breakpoint">
                <Input
                  id="ck-breakpoint"
                  type="number"
                  value={breakpointPercentile}
                  onChange={(e) => setBreakpointPercentile(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div>
            <Button
              onClick={() => void handleRun()}
              disabled={!datasetId || selectedModelIds.size === 0 || running || activeRunId != null}
            >
              {running || activeRunId != null ? "실행 중…" : "벤치마크 실행"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>실행 이력</CardTitle>
          <span className="text-xs text-ink-muted">최근 실행순</span>
        </CardHeader>
        <div className="flex flex-col divide-y divide-border">
          {!loading && runs.length === 0 && (
            <p className="p-5 text-center text-sm text-ink-muted">아직 실행한 벤치마크가 없습니다.</p>
          )}
          {loading && <p className="p-5 text-center text-sm text-ink-muted">불러오는 중…</p>}
          {runs.map((run) => (
            <div key={run.id} className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">Run #{run.id}</span>
                  <EmbeddingJobStatusBadge status={run.status} />
                  {run.id === activeRunId && <span className="text-xs text-ink-muted">폴링 중…</span>}
                </div>
                <span className="text-xs text-ink-muted">
                  top_k {run.rag_top_k} · min_score {run.rag_min_score}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] whitespace-nowrap text-xs">
                  <thead>
                    <tr className="text-left text-ink-muted">
                      <th className="py-1.5 pr-4 font-medium">Model</th>
                      <th className="py-1.5 pr-4 font-medium">Status</th>
                      <th className="py-1.5 pr-4 font-medium">Recall@1/3/5</th>
                      <th className="py-1.5 pr-4 font-medium">MRR</th>
                      <th className="py-1.5 pr-4 font-medium">nDCG</th>
                      <th className="py-1.5 pr-4 font-medium">Latency</th>
                      <th className="py-1.5 pr-4 font-medium">RAM</th>
                      <th className="py-1.5 pr-4 font-medium">Score</th>
                      <th className="py-1.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {run.results.map((res) => (
                      <tr key={res.id}>
                        <td className="py-2 pr-4 font-medium text-ink">{modelName(res.embedding_model_id)}</td>
                        <td className="py-2 pr-4">
                          <EmbeddingJobStatusBadge status={res.status} />
                        </td>
                        <td className="py-2 pr-4 text-ink-muted">
                          {fmt(res.recall_at_1)} / {fmt(res.recall_at_3)} / {fmt(res.recall_at_5)}
                        </td>
                        <td className="py-2 pr-4 text-ink-muted">{fmt(res.mrr)}</td>
                        <td className="py-2 pr-4 text-ink-muted">{fmt(res.ndcg)}</td>
                        <td className="py-2 pr-4 text-ink-muted">
                          {res.avg_query_latency_ms != null ? `${Math.round(res.avg_query_latency_ms)}ms` : "—"}
                        </td>
                        <td className="py-2 pr-4 text-ink-muted">
                          {res.ram_mb != null ? `${(res.ram_mb / 1024).toFixed(1)}GB` : "—"}
                        </td>
                        <td className="py-2 pr-4 font-medium text-ink">{fmt(res.score, 1)}</td>
                        <td className="py-2">
                          {res.status === "COMPLETED" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setApplyTarget({
                                  runId: run.id,
                                  modelId: res.embedding_model_id,
                                  modelName: modelName(res.embedding_model_id),
                                })
                              }
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              운영 적용
                            </button>
                          ) : res.status === "FAILED" && res.error ? (
                            <span className="text-xs text-primary" title={res.error}>
                              실패
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <DatasetModal
        open={datasetModalOpen}
        onClose={() => setDatasetModalOpen(false)}
        onCreated={(dataset) => {
          setDatasets((prev) => [dataset, ...prev]);
          setDatasetId(String(dataset.id));
          setDatasetModalOpen(false);
        }}
      />

      <ConfirmDialog
        open={applyTarget != null}
        title="운영에 적용"
        message={`이 (청킹 설정, "${applyTarget?.modelName}") 조합을 운영 기본값으로 적용합니다. 기존 문서는 자동으로 재처리되지 않아요 — 필요하면 마이그레이션 탭에서 별도로 실행해 주세요.`}
        confirmLabel="적용"
        busy={applyBusy}
        onConfirm={() => void handleApplyConfirm()}
        onCancel={() => setApplyTarget(null)}
      />
    </div>
  );
}
