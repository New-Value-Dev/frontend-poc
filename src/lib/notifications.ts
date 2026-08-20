import { api } from "./api";
import type {
  NotificationItem,
  NotificationListResponse,
  UnreadCountResponse,
} from "./types";

/**
 * 인앱 알림함. 백엔드에 SSE/WebSocket이 없으므로 벨은 폴링으로 갱신한다
 * Web Push를 거부한 사용자도 이 목록으로는 알림을 받는다.
 */
export function listNotifications(params: {
  onlyUnread?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.onlyUnread) query.set("only_unread", "true");
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  return api.get<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ""}`);
}

/** 목록 없이 뱃지 숫자만 폴링할 때. */
export function getUnreadCount() {
  return api.get<UnreadCountResponse>("/notifications/unread-count");
}

export function markNotificationRead(notificationId: number) {
  return api.post<NotificationItem>(`/notifications/${notificationId}/read`);
}

export function markAllNotificationsRead() {
  return api.post<UnreadCountResponse>("/notifications/read-all");
}
