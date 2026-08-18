"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { initialsOf } from "@/lib/auth";

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-canvas px-6">
      {/* 전역 문서/RAG 검색창 (스켈레톤 — 아직 미동작) */}
      <div className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-ink-muted">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-sm">문서 · 프로젝트 검색</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs">
          <button type="button" className="font-semibold text-ink underline underline-offset-4">
            KOR
          </button>
          <span className="text-border">|</span>
          <button type="button" className="text-ink-muted hover:text-ink">
            ENG
          </button>
        </div>

        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface"
          aria-label="알림"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </button>

        <div className="flex items-center gap-2 pl-1">
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white"
            title={user?.name ?? user?.email ?? "게스트"}
          >
            {user ? initialsOf(user) : "PN"}
          </span>
          {user && (
            <button
              type="button"
              onClick={logout}
              className="text-xs text-ink-muted hover:text-ink"
            >
              로그아웃
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
