import { api } from "./api";
import type { DocumentVersion, VersionStatus, Section } from "./types";

export function listVersions(docId: string) {
  return api.get<DocumentVersion[]>(`/documents/${docId}/versions`);
}

export function getVersion(versionId: string) {
  return api.get<DocumentVersion>(`/versions/${versionId}`);
}

/** 기존 문서에 새 버전(v2+)을 추가 — 202 + 새 버전, 파싱은 백그라운드에서 계속됨. */
export function createVersion(docId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.post<DocumentVersion>(`/documents/${docId}/versions`, form, {
    form: true,
  });
}

/** 파싱된 섹션 목록 — 아웃라인과 문서 뷰어의 기반 데이터. */
export function getSections(versionId: number) {
  return api.get<Section[]>(`/versions/${versionId}/sections`);
}

/** 문서 처리 중 폴링용 경량 상태 값. */
export function getVersionStatus(versionId: number) {
  return api.get<VersionStatus>(`/versions/${versionId}/status`);
}

/** 버전 상태가 READY/FAILED가 될 때까지 폴링하고 최종 상태를 반환. 업로드 → 처리 UX용, 추후 SSE로 대체 예정. */
export async function pollUntilReady(
  versionId: number,
  { intervalMs = 2000, timeoutMs = 300_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { status } = await getVersionStatus(versionId);
    if (status === "READY" || status === "FAILED") return status;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("문서 처리 시간이 초과되었습니다.");
}
