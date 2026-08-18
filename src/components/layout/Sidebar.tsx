"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
  { href: "/search", label: "RAG 검색", icon: <IconChat />, match: (p) => p.startsWith("/search") },
];

const adminNav: NavItem[] = [
  {
    href: "/embedding-lab",
    label: "Embedding Lab",
    icon: <IconBeaker />,
    match: (p) => p.startsWith("/embedding-lab"),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-canvas">
      {/* 브랜드 */}
      <Link
        href="/"
        className={`mx-3 mt-3 mb-2 flex items-center gap-2.5 rounded-control px-2 py-2.5 ${FOCUS_RING}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-control bg-white">
          <Image src="/pcn-logo.png" alt="PCN" width={32} height={32} className="h-full w-full object-contain" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-ink">사이드프로젝트</span>
          <span className="text-xs text-ink-muted">NV개발</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item, pathname)} />
        ))}

        <p className="px-3 pt-6 pb-2 text-xs font-semibold text-ink-muted">관리자</p>
        {adminNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item, pathname)} />
        ))}
      </nav>

      {/* 대시보드/프로젝트/문서가 API에 연동되며 `Phase 0 skeleton` 표기는 더 이상 맞지 않아 제거함. */}
      <div className="border-t border-border px-5 py-4 text-xs text-ink-muted">v0.1</div>
    </aside>
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
