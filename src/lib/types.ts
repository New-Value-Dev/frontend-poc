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

export type Visibility = "private" | "invite" | "public";
export type MemberRole = "owner" | "member";
export type MemberStatus = "pending" | "active" | "rejected";

/* 백엔드 app/schemas/project.py · folder.py · document.py 반영 (snake_case). */
export type Project = {
  id: number;
  name: string;
  description: string | null;
  created_by: string | null;
  owner_id: number | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
};

export type ProjectMember = {
  user_id: number;
  email: string;
  name: string | null;
  role: MemberRole;
  status: MemberStatus;
  invited_by: number | null;
  created_at: string;
  responded_at: string | null;
};

export type ProjectInvitation = {
  project_id: number;
  project_name: string;
  project_description: string | null;
  visibility: Visibility;
  invited_by: number | null;
  invited_by_name: string | null;
  invited_by_email: string | null;
  invited_at: string;
};

export type UserSearchResult = {
  id: number;
  email: string;
  name: string | null;
};

export type Folder = {
  id: number;
  project_id: number;
  parent_id: number | null;
  name: string;
  rank: number;
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

export type DiffToken = { op: "equal" | "insert" | "delete"; text: string };

export type SectionDiff = {
  op: "unchanged" | "added" | "deleted" | "modified";
  from_section_id: number | null;
  to_section_id: number | null;
  level: number | null;
  section_type: string | null;
  title: string | null;
  tokens: DiffToken[];
};

export type DiffSummary = { added: number; deleted: number; modified: number; unchanged: number };
export type VersionRef = { id: number; version_no: number };

export type DiffResult = {
  document_id: number;
  from_version: VersionRef;
  to_version: VersionRef;
  sections: SectionDiff[];
  summary: DiffSummary;
};

/* --- AI 모듈 --- */
/* 오타 검증 (백엔드 app/schemas/proofread.py 반영) */
export type FindingStatus = "pending" | "accepted" | "rejected";

export type ProofreadFinding = {
  id: string; // 이 분석 안에서 고정 (위치 기반: f0, f1, f2...)
  original: string;
  suggestion: string;
  reason: string;
  category: string; // spelling | spacing | grammar | expression
  section_id: number | null;
  page_start: number | null;
  page_end: number | null;
  status: FindingStatus;
};

/** POST .../apply 응답 — 승인된 finding을 원본 파일에 반영해 만든 새 버전 정보. */
export type ApplyAnalysisResult = {
  analysis_id: number;
  document_id: number;
  new_version_id: number;
  new_version_no: number;
  applied_count: number;
  skipped_count: number;
  skipped_reasons: string[];
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
  /** 이 분석으로 교정을 적용해 만든 버전 — null이면 아직 미적용. 새로고침 후에도 적용 버튼을 숨기는 데 쓴다. */
  applied_version_id: number | null;
  applied_at: string | null;
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

/* --- RAG (백엔드 app/schemas/rag.py 반영, snake_case) --- */
export type CitationRead = {
  document_id: number;
  document_name: string;
  section_id: number | null;
  chunk_id: number;
  page_start: number | null;
  page_end: number | null;
  score: number;
};

export type RagAnswer = {
  id: number;
  question: string;
  answer: string;
  citations: CitationRead[];
  provider: string | null;
  created_at: string;
};

export type RagScope = { project_ids?: number[]; folder_ids?: number[] };

export type RagHistoryItem = { id: number; question: string; created_at: string };

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

/* --- MyPage --- */
/** `DashboardSummary`/`ActivityItem`과 달리 project_id가 아니라 로그인 사용자(created_by/actor_id) 기준으로 스코핑됨. */
export type MyPageProfile = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  provider: string;
  lastLoginAt: string | null;
  memberSince: string;
};

export type MyPageSummary = {
  profile: MyPageProfile;
  stats: { projects: number; documents: number; processing: number };
  recentActivity: ActivityItem[];
};

export type NotificationType =
  | "project.invite"
  | "project.invite_accepted"
  | "project.invite_declined"
  | "project.member_removed"
  | "analysis.complete"
  | "analysis.fail";

export type NotificationItem = {
  id: number;
  type: NotificationType | string;
  title: string;
  body: string | null;
  url: string | null;
  meta: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationListResponse = { items: NotificationItem[]; unread: number };

export type UnreadCountResponse = { unread: number };

export type PublicKeyResponse = { public_key: string };

export type PushSubscribeRequest = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushUnsubscribeRequest = { endpoint: string };

/* --- Common --- */
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };
