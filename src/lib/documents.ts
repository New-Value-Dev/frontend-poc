import { api, ApiError, BASE_URL, getAccessToken } from "./api";
import type { Document, DocumentUploadResponse, RecentDocument } from "./types";

export function listDocuments(
  projectId: string,
  filters?: { folder_id?: number; status?: string; type?: string },
) {
  const params = new URLSearchParams();
  if (filters?.folder_id != null) params.set("folder_id", String(filters.folder_id));
  if (filters?.status) params.set("status", filters.status);
  if (filters?.type) params.set("type", filters.type);
  const q = params.toString();
  return api.get<Document[]>(`/projects/${projectId}/documents${q ? `?${q}` : ""}`);
}

/**
 * 호출자가 볼 수 있는 모든 프로젝트를 통틀어 가장 최신 문서 — 프로젝트 범위가 아닌
 * 유일한 문서 목록. 백엔드가 `limit`을 1~50으로 제한한다.
 */
export function listRecentDocuments(limit = 5, projectId?: number) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (projectId != null) params.set("project_id", String(projectId));
  return api.get<RecentDocument[]>(`/documents/recent?${params}`);
}

/** 멀티파트 업로드 → 202 Accepted 응답, 처리는 백그라운드에서 계속됨. */
export function uploadDocument(
  projectId: string,
  file: File,
  opts?: { folder_id?: number; name?: string; description?: string },
) {
  const form = new FormData();
  form.append("file", file);
  if (opts?.folder_id != null) form.append("folder_id", String(opts.folder_id));
  if (opts?.name) form.append("name", opts.name);
  if (opts?.description) form.append("description", opts.description);
  return api.post<DocumentUploadResponse>(`/projects/${projectId}/documents`, form, {
    form: true,
  });
}

export function getDocument(docId: string) {
  return api.get<Document>(`/documents/${docId}`);
}

export function deleteDocument(docId: string) {
  return api.delete<void>(`/documents/${docId}`);
}

/**
 * 원본 파일을 blob으로 받는다. 엔드포인트가 Bearer 헤더를 요구하므로 단순
 * `<a href>`/`<iframe src>`는 401이 난다 — 인증을 담아 직접 fetch해야 한다.
 * 다운로드와 미리보기가 공유하는 기반 함수.
 */
export async function fetchDocumentBlob(docId: string): Promise<Blob> {
  const token = getAccessToken();
  const res = await fetch(`${BASE_URL}/documents/${docId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    // 다운로드 URL이 버전이 바뀌어도 동일해서, 브라우저 캐시에 기대면 적용 직후 재다운로드해도
    // 옛 버전이 나올 수 있다. 서버가 Cache-Control: no-store를 보내지만 프론트에서도 명시해 둔다.
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, "파일을 불러오지 못했습니다.");
  return res.blob();
}

export async function downloadDocument(docId: string, filename?: string) {
  const blob = await fetchDocumentBlob(docId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "document";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
