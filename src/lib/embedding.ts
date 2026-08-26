import { api } from "./api";
import type {
  BenchmarkDataset,
  BenchmarkQuestionCreate,
  BenchmarkRun,
  ChunkingConfigOverride,
  EmbeddingJob,
  EmbeddingModel,
} from "./types";


/* --- 모델 --- */
export function listModels() {
  return api.get<EmbeddingModel[]>("/embedding/models");
}

export function activateModel(modelId: number) {
  return api.post<EmbeddingModel>(`/embedding/models/${modelId}/activate`);
}

export function reembedModel(modelId: number) {
  return api.post<EmbeddingJob>(`/embedding/models/${modelId}/reembed`);
}

/* --- 벤치마크 데이터셋 --- */
export function listDatasets() {
  return api.get<BenchmarkDataset[]>("/embedding/datasets");
}

export function createDataset(input: {
  name: string;
  description?: string;
  project_id?: number;
  questions: BenchmarkQuestionCreate[];
}) {
  return api.post<BenchmarkDataset>("/embedding/datasets", input);
}

/* --- 벤치마크 실행 --- */
export function listBenchmarks() {
  return api.get<BenchmarkRun[]>("/embedding/benchmarks");
}

export function runBenchmark(input: {
  dataset_id: number;
  model_ids: number[];
  chunking_config?: ChunkingConfigOverride;
}) {
  return api.post<{ run_id: number }>("/embedding/benchmarks/run", input);
}

export function getBenchmark(runId: number) {
  return api.get<BenchmarkRun>(`/embedding/benchmarks/${runId}`);
}

export function applyBenchmark(runId: number, modelId: number) {
  return api.post<{ chunking_config_id: number; embedding_model_id: number }>(
    `/embedding/benchmarks/${runId}/apply`,
    { model_id: modelId },
  );
}

export function migrate(input: { document_version_ids: number[]; force_semantic?: boolean }) {
  return api.post<EmbeddingJob>("/embedding/migrate", input);
}

export function getJob(jobId: number) {
  return api.get<EmbeddingJob>(`/embedding/jobs/${jobId}`);
}
