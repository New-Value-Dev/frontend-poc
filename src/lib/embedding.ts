import { api } from "./api";
import type { EmbeddingModel } from "./types";

export function listModels() {
  return api.get<EmbeddingModel[]>("/embedding/models");
}

export function activateModel(id: string) {
  return api.post<EmbeddingModel>(`/embedding/models/${id}/activate`);
}

export function reembed(id: string) {
  return api.post<{ jobId: string }>(`/embedding/models/${id}/reembed`);
}

export type BenchmarkRun = {
  runId: string;
  datasetId: string;
  results: { modelId: string; recall: number; latencyMs: number; ram: string; score: number }[];
};

export function listBenchmarks() {
  return api.get<BenchmarkRun[]>("/embedding/benchmarks");
}

export function runBenchmark(datasetId: string, modelIds: string[]) {
  return api.post<{ runId: string }>("/embedding/benchmarks/run", { datasetId, modelIds });
}

export function getBenchmark(runId: string) {
  return api.get<BenchmarkRun>(`/embedding/benchmarks/${runId}`);
}
