"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { initialsOf } from "@/lib/auth";
import { FOCUS_RING } from "@/components/ui/primitives";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

      {/* 전역 문서/RAG 검색창 (스켈레톤 — 아직 미동작) */}
      <div className="flex h-9 w-full min-w-0 max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-ink-muted">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="truncate text-sm">문서 · 프로젝트 검색</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface"
          aria-label="알림"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </button>

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
