/*
 * 공용 API 타입 — 백엔드의 Pydantic 스키마(sidepjt/backend)를 그대로 반영.
 * 두 저장소가 타입 패키지로 연결돼 있지 않으므로 수동으로 동기화할 것.
 */

/* --- Auth (백엔드 app/schemas/auth.py 반영) --- */
/** `GET /auth/providers`는 provider 키 목록을 반환 (예: ["google"] / ["mock"]). */
export type ProvidersResponse = { providers: string[] };

export type User = {
  id: number;
  email: string;
  name: string | null;
  role: string;
};

export type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in: number;
};

/* --- Documents --- */
export type DocStatus =
  | "UPLOADED"
  | "PARSING"
  | "PARSED"
  | "CHUNKING"
  | "CHUNKED"
  | "EMBEDDING"
  | "READY"
  | "FAILED";

/* 백엔드 app/schemas/project.py · folder.py · document.py 반영 (snake_case). */
export type Project = {
  id: number;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: number;
  project_id: number;
  parent_id: number | null;
  name: string;
  created_at: string;
};

export type AuthorInfo = { id: number | null; name: string | null; email: string | null };

export type Document = {
  id: number;
  project_id: number;
  folder_id: number | null;
  name: string;
  document_type: string | null;
  description: string | null;
  current_version_id: number | null;
  created_by: string | null;
  author: AuthorInfo | null;
  current_version: DocumentVersion | null;
  created_at: string;
  updated_at: string;
};

export type DocumentVersion = {
  id: number;
  document_id: number;
  version_no: number;
  original_file_name: string;
  mime_type: string | null;
  file_size: number | null;
  checksum: string | null;
  processing_status: string;
  parser_version: string | null;
  created_at: string;
};

/**
 * 백엔드 `RecentDocumentRead` 반영 — 대시보드 "최근 문서" 카드용 평탄화된 뷰라서
 * 프로젝트 경로와 상태 배지를 추가 요청 없이 그릴 수 있다.
 * `processing_status`는 `documents.status`가 아니라 현재 버전의 상태이며,
 * 버전이 아직 없으면 `UPLOADED`로 대체된다.
 */
export type RecentDocument = {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  processing_status: string;
  created_at: string;
};

export type VersionStatus = { version_id: number; status: string; progress: number };

export type DocumentUploadResponse = { document: Document; version: DocumentVersion };

/* 백엔드 SectionRead 반영. */
export type Section = {
  id: number;
  document_version_id: number;
  parent_section_id: number | null;
  title: string | null;
  section_type: string | null;
  page_start: number | null;
  page_end: number | null;
  order_no: number;
  content: string | null;
  meta: Record<string, unknown> | null;
};

/* --- AI 모듈 --- */
/* 오타 검증 (백엔드 app/schemas/proofread.py 반영) */
export type ProofreadFinding = {
  original: string;
  suggestion: string;
  reason: string;
  category: string; // spelling | spacing | grammar | expression
  section_id: number | null;
  page_start: number | null;
  page_end: number | null;
};

export type ProofreadResult = {
  id: number;
  document_id: number;
  document_version_id: number;
  analysis_type: string;
  status: string; // RUNNING | COMPLETED | FAILED
  provider: string | null; // mock | openai
  findings: ProofreadFinding[];
  sections_scanned: number;
  error: string | null;
  created_at: string;
};

export type AnalysisSummary = {
  id: number;
  document_id: number;
  document_version_id: number;
  analysis_type: string;
  status: string;
  provider: string | null;
  created_at: string;
};

export type Correction = {
  original: string;
  suggestion: string;
  reason?: string;
  kind?: string;
};

export type Classification = {
  documentType: string;
  category: string;
  tags: string[];
};

export type ValidationIssue = {
  severity: "info" | "warning" | "critical";
  message: string;
  ruleRef?: string;
};

export type RelatedDocument = { documentId: string; name: string; score: number };

/* --- RAG --- */
export type Citation = {
  documentId: string;
  sectionId: string;
  pageStart?: number;
  pageEnd?: number;
  score: number;
  name: string;
};

export type RagAnswer = { answer: string; citations: Citation[] };

export type RagScope = { projectIds?: string[]; folderIds?: string[] };

/* --- Embedding Lab --- */
export type EmbeddingModel = {
  id: string;
  key: string;
  name: string;
  status: "ACTIVE" | "TESTED" | "TEST";
  recall: number;
  latencyMs: number;
  ram: string;
  dimension: number;
  isActive: boolean;
};

/* --- Dashboard --- */
export type DashboardSummary = {
  stats: { projects: number; documents: number; processing: number; ragToday: number };
  weeklyProcessing: number[];
  documentTypes: { label: string; value: number }[];
  pipeline: { status: DocStatus; count: number }[];
};

export type ActivityItem = {
  actor: string;
  action: string;
  target: string;
  kind: string;
  at: string;
  targetType: string | null;
  targetId: number | null;
  targetAlive: boolean;
};

/* --- Common --- */
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };
