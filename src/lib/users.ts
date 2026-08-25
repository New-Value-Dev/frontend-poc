import { api } from "./api";
import type { UserSearchResult } from "./types";

/** 백엔드 `SEARCH_MIN_LENGTH` — 1자로 호출하면 422다. 호출 전에 프론트에서 먼저 막는다. */
export const USER_SEARCH_MIN_LENGTH = 2;

export function searchUsers(
  q: string,
  options: { limit?: number; excludeProjectId?: number } = {},
) {
  const query = new URLSearchParams({ q });
  if (options.limit != null) query.set("limit", String(options.limit));
  if (options.excludeProjectId != null) {
    query.set("exclude_project_id", String(options.excludeProjectId));
  }
  return api.get<UserSearchResult[]>(`/users/search?${query}`);
}
