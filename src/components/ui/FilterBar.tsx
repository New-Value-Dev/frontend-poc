"use client";

import type { ReactNode } from "react";
import { FOCUS_RING, Input } from "./primitives";


export function FilterBar({
  search,
  children,
  trailing,
  activeCount = 0,
  onReset,
}: {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  children?: ReactNode;
  trailing?: ReactNode;
  activeCount?: number;
  onReset?: () => void;
}) {
  const reset =
    onReset && activeCount > 0 ? (
      <button
        type="button"
        onClick={onReset}
        className={`rounded-full px-2.5 py-1.5 text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline ${FOCUS_RING}`}
      >
        초기화 {activeCount}
      </button>
    ) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-panel border border-border bg-canvas px-3 py-2.5">
      {search && (
        <SearchInput
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
          className="w-full sm:w-60"
        />
      )}
      {children}
      {reset}
      {trailing && (
        <span className="ml-auto shrink-0 whitespace-nowrap text-sm text-ink-muted">
          {trailing}
        </span>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "검색…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className={`absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink ${FOCUS_RING}`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
