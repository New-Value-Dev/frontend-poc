import { api } from "./api";
import type {
  ProofreadResult,
  AnalysisSummary,
  Classification,
  ValidationIssue,
  RelatedDocument,
} from "./types";

/** 문서의 현재 버전에 대해 오타 검증을 실행 → 저장된 분석 결과 반환. */
export function proofread(docId: string) {
  return api.post<ProofreadResult>(`/documents/${docId}/proofread`);
}

/** AI 분석 이력 (메타데이터만). */
export function listAnalyses(docId: string, type?: string) {
  return api.get<AnalysisSummary[]>(
    `/documents/${docId}/analyses${type ? `?type=${type}` : ""}`,
  );
}

/** findings를 포함한 전체 분석 결과. */
export function getAnalysis(docId: string, analysisId: number) {
  return api.get<ProofreadResult>(`/documents/${docId}/analyses/${analysisId}`);
}

export function classify(docId: string) {
  return api.post<Classification>(`/documents/${docId}/classify`);
}

export function validate(docId: string) {
  return api.post<{ issues: ValidationIssue[] }>(`/documents/${docId}/validate`);
}

export function related(docId: string) {
  return api.post<RelatedDocument[]>(`/documents/${docId}/related`);
}

export type DiffResult = {
  added: number;
  removed: number;
  modified: number;
  semantic: number;
  explanation: string;
};

export function compare(baseVersionId: string, targetVersionId: string) {
  return api.post<DiffResult>("/documents/compare", { baseVersionId, targetVersionId });
}
