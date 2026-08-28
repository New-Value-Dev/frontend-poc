import { api } from "./api";
import type {
  AdminUsagePeriod,
  BillingSummary,
  KeywordRanking,
  LLMUsageLogPage,
  RagAdminLogPage,
  UsageSummary,
} from "./types";

/* 백엔드 app/api/v1/admin.py 반영. 전부 role=admin 전용(403). */
const ADMIN_API_TIMEOUT_MS = 30_000;

export function getUsageSummary(period: AdminUsagePeriod = "month") {
  return api.get<UsageSummary>(`/admin/usage/summary?period=${period}`, {
    timeoutMs: ADMIN_API_TIMEOUT_MS,
  });
}

export function listUsageLogs(filters?: {
  feature?: string;
  status?: string;
  page?: number;
  size?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.feature) params.set("feature", filters.feature);
  if (filters?.status) params.set("status", filters.status);
  params.set("page", String(filters?.page ?? 1));
  params.set("size", String(filters?.size ?? 20));
  return api.get<LLMUsageLogPage>(`/admin/usage/logs?${params}`);
}

/** 실제 OpenAI Admin API 키가 설정돼 있지 않으면 폴백 */
export function getBillingSummary(chartPeriod: AdminUsagePeriod = "month") {
  return api.get<BillingSummary>(`/admin/billing/summary?chart_period=${chartPeriod}`, {
    timeoutMs: ADMIN_API_TIMEOUT_MS,
  });
}

export function getSearchKeywords(period: AdminUsagePeriod = "month", top = 20) {
  return api.get<KeywordRanking>(`/admin/search/keywords?period=${period}&top=${top}`);
}

export function listRagLogs(filters?: { user_id?: number; page?: number; size?: number }) {
  const params = new URLSearchParams();
  if (filters?.user_id != null) params.set("user_id", String(filters.user_id));
  params.set("page", String(filters?.page ?? 1));
  params.set("size", String(filters?.size ?? 20));
  return api.get<RagAdminLogPage>(`/admin/rag/logs?${params}`);
}
