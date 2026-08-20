"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { initialsOf } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { searchDocuments } from "@/lib/documents";
import type { RecentDocument } from "@/lib/types";
import { FOCUS_RING, StatusBadge } from "@/components/ui/primitives";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const SEARCH_DEBOUNCE_MS = 300;

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, loading: authLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecentDocument[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // 검색어 debounce → `/documents/search` 호출.
  useEffect(() => {
    if (authLoading) return;
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchDocuments(q, 8)
        .then((docs) => {
          if (!cancelled) setResults(docs);
        })
        .catch((e) => {
          if (!cancelled) setSearchError(errorMessage(e, "검색에 실패했습니다."));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, authLoading]);

  // 바깥 클릭/Esc 시 검색 결과 드롭다운을 닫는다.
  useEffect(() => {
    if (!searchOpen) return;
    function onOutside(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  function goToDocument(id: number) {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/documents/${id}`);
  }

  // 바깥 클릭/Esc/라우트 이동 시 계정 메뉴를 닫는다.
  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-canvas px-4 sm:gap-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="메뉴 열기"
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface lg:hidden ${FOCUS_RING}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* 전역 문서 검색 (`GET /documents/search`) */}
      <div ref={searchRef} className="relative w-full min-w-0 max-w-md">
        <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-ink-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              setSearchOpen(true);
              if (!value.trim()) {
                setResults([]);
                setSearching(false);
                setSearchError(null);
              }
            }}
            onFocus={() => query.trim() && setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length > 0) goToDocument(results[0].id);
              if (e.key === "Escape") setSearchOpen(false);
            }}
            placeholder="문서 검색"
            aria-label="문서 검색"
            className="w-full min-w-0 truncate bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              aria-label="검색어 지우기"
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink ${FOCUS_RING}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>

        {searchOpen && query.trim() && (
          <div
            role="listbox"
            className="absolute left-0 top-full z-50 mt-2 w-full min-w-[18rem] overflow-hidden rounded-panel border border-border bg-canvas py-1 shadow-lg"
          >
            {searching ? (
              <p className="px-3 py-3 text-sm text-ink-muted">검색 중…</p>
            ) : searchError ? (
              <p className="px-3 py-3 text-sm text-primary">{searchError}</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-muted">일치하는 문서가 없습니다.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {results.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => goToDocument(d.id)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-surface ${FOCUS_RING} focus-visible:ring-offset-0`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{d.name}</span>
                        <span className="block truncate text-xs text-ink-muted">{d.project_name}</span>
                      </span>
                      <span className="shrink-0">
                        <StatusBadge status={d.processing_status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <NotificationBell />

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="계정 메뉴"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white ${FOCUS_RING}`}
            title={user?.name ?? user?.email ?? "게스트"}
          >
            {user ? initialsOf(user) : "PN"}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-panel border border-border bg-canvas py-1 shadow-lg"
            >
              <Link
                href="/mypage"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 text-sm text-ink hover:bg-surface ${FOCUS_RING}`}
              >
                마이페이지
              </Link>
              {user && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className={`block w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface hover:text-ink ${FOCUS_RING}`}
                >
                  로그아웃
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
