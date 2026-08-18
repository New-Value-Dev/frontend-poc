import { api } from "./api";
import type { DashboardSummary, ActivityItem } from "./types";

export function getSummary() {
  return api.get<DashboardSummary>("/dashboard/summary");
}

export function getActivity(limit = 10) {
  return api.get<ActivityItem[]>(`/activity?limit=${limit}`);
}
