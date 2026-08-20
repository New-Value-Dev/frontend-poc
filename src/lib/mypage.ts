import { api } from "./api";
import type { MyPageSummary } from "./types";

export function getMyPageSummary(activityLimit = 10) {
  return api.get<MyPageSummary>(`/mypage/summary?activity_limit=${activityLimit}`);
}
