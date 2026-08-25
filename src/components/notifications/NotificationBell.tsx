"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { errorMessage } from "@/lib/api";
import {
  listNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { SW_NOTIFICATION_MESSAGE, registerServiceWorker, setAppBadge } from "@/lib/push";
import type { NotificationItem } from "@/lib/types";
import { FOCUS_RING, NotificationTypeBadge } from "@/components/ui/primitives";
import { relativeTime } from "@/components/activity/ActivityFeed";

const POLL_MS = 60_000;
const LIST_LIMIT = 20;

export function NotificationBell() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const refreshUnread = useCallback(async () => {
    try {
      const { unread: count } = await getUnreadCount();
      setUnread(count);
      setAppBadge(count);
    } catch {
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const { items: list, unread: count } = await listNotifications({ limit: LIST_LIMIT });
      setItems(list);
      setUnread(count);
      setAppBadge(count);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "알림을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    refreshUnread();
    const timer = setInterval(refreshUnread, POLL_MS);
    const onFocus = () => refreshUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [authLoading, user, refreshUnread]);

  useEffect(() => {
    if (authLoading || !user) return;
    registerServiceWorker();
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type !== SW_NOTIFICATION_MESSAGE) return;
      refreshUnread();
      if (openRef.current) loadList();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [authLoading, user, refreshUnread, loadList]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  }

  async function handleClick(item: NotificationItem) {
    setOpen(false);
    if (!item.read_at) {
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x)),
      );
      setUnread((n) => Math.max(0, n - 1));
      markNotificationRead(item.id)
        .then(refreshUnread)
        .catch(refreshUnread);
    }
    const href = targetHref(item);
    if (href) router.push(href);
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
      setUnread(0);
      setAppBadge(0);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "읽음 처리에 실패했습니다."));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `알림 ${unread}건 안 읽음` : "알림"}
        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface ${FOCUS_RING}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden
            className="tnum absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold leading-none text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-panel border border-border bg-canvas shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">알림</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll}
                className={`rounded-sm text-xs text-ink-muted hover:text-ink disabled:opacity-50 ${FOCUS_RING}`}
              >
                {markingAll ? "처리 중…" : "모두 읽음"}
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="px-4 py-3 text-sm text-primary">
              {error}
            </p>
          )}

          {loading && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">불러오는 중…</p>
          ) : items.length === 0 && !error ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">받은 알림이 없습니다.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleClick(item)}
                    className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-surface ${FOCUS_RING} focus-visible:ring-offset-0 ${
                      item.read_at ? "" : "bg-primary-soft/40"
                    }`}
                  >
                    <span className="flex w-full items-center gap-2">
                      <NotificationTypeBadge type={item.type} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {relativeTime(item.created_at)}
                      </span>
                    </span>
                    {item.body && (
                      <span className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
                        {item.body}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function targetHref(item: NotificationItem): string | null {
  if (item.type === "project.invite") return "/projects";
  return item.url;
}
