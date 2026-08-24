"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FOCUS_RING } from "@/components/ui/primitives";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** 하위 라우트(예: /projects/123)도 활성 상태로 판단 */
  match?: (path: string) => boolean;
};

const nav: NavItem[] = [
  { href: "/", label: "대시보드", icon: <IconGrid />, match: (p) => p === "/" },
  {
    href: "/projects",
    label: "프로젝트",
    icon: <IconFolder />,
    match: (p) => p.startsWith("/projects") || p.startsWith("/documents"),
  },
  {
    href: "/proofread",
    label: "맞춤법 검사기",
    icon: <IconPencil />,
    match: (p) => p.startsWith("/proofread"),
  },
  { href: "/search", label: "RAG", icon: <IconChat />, match: (p) => p.startsWith("/search") },
  { href: "/quiz", label: "퀴즈", icon: <IconQuiz />, match: (p) => p.startsWith("/quiz") },
];

const adminNav: NavItem[] = [
  {
    href: "/embedding-lab",
    label: "Embedding Lab",
    icon: <IconBeaker />,
    match: (p) => p.startsWith("/embedding-lab"),
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  // 모바일 드로어가 열려 있는 동안 Esc로 닫고, 배경 스크롤을 막는다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      {/* 모바일 전용 배경 오버레이 — lg 이상에서는 사이드바가 상시 노출되므로 불필요 */}
      {open && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-border bg-canvas transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center justify-between px-3 pt-3">
          {/* 브랜드 */}
          <Link
            href="/"
            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 py-2.5 ${FOCUS_RING}`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-control bg-white">
              <Image src="/pcn-logo.png" alt="PCN" width={32} height={32} className="h-full w-full object-contain" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-ink">사이드프로젝트</span>
              <span className="text-xs text-ink-muted">NV개발</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface lg:hidden ${FOCUS_RING}`}
          >
            <IconClose />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 pb-2">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item, pathname)} />
          ))}

          <p className="px-3 pt-6 pb-2 text-xs font-semibold text-ink-muted">관리자</p>
          {adminNav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item, pathname)} />
          ))}
        </nav>

        <div className="border-t border-border px-5 py-4 text-xs text-ink-muted">v0.1</div>
      </aside>
    </>
  );
}

function isActive(item: NavItem, pathname: string) {
  return item.match ? item.match(pathname) : pathname === item.href;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors ${FOCUS_RING} ${
        active
          ? "bg-primary-soft font-medium text-primary"
          : "text-ink-muted hover:bg-surface hover:text-ink"
      }`}
    >
      <span className={active ? "text-primary" : "text-ink-muted"}>{item.icon}</span>
      {item.label}
    </Link>
  );
}

/* --- 인라인 아이콘 (외부 아이콘 의존성 없음) --- */
function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z" />
    </svg>
  );
}
function IconBeaker() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
    </svg>
  );
}
function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function IconQuiz() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.3 1.1-1.3 1.9V14" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
