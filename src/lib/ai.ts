import { api } from "./api";
import type {
  ProofreadResult,
  AnalysisSummary,
  Classification,
  ValidationIssue,
  RelatedDocument,
  FindingStatus,
  ApplyAnalysisResult,
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

/** finding 하나를 승인/반려/보류로 표시. 응답은 갱신된 findings를 포함한 분석 전체. */
export function setFindingStatus(
  docId: string,
  analysisId: number,
  findingId: string,
  status: FindingStatus,
) {
  return api.patch<ProofreadResult>(
    `/documents/${docId}/analyses/${analysisId}/findings/${findingId}`,
    { status },
  );
}

/**
 * 그 시점까지 accepted로 표시된 finding을 원본 파일에 반영해 새 버전을 만든다.
 * 분석 1건당 1회만 가능 — 이미 적용한 분석에 다시 호출하면 409.
 */
export function applyAnalysis(docId: string, analysisId: number) {
  return api.post<ApplyAnalysisResult>(`/documents/${docId}/analyses/${analysisId}/apply`);
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
