"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FOCUS_RING } from "./primitives";

export type IconMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  onSelect: () => void;
  disabled?: boolean;
};

/** 타일 우상단 케밥(⋯) 드롭다운. Topbar 계정 메뉴 패턴을 일반화한 공용 컴포넌트. */
export function IconMenu({
  items,
  ariaLabel,
  align = "end",
}: {
  items: IconMenuItem[];
  ariaLabel: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          // 케밥은 타일의 이동 클릭 영역과 형제 요소이지만, 방어적으로 한 번 더 막는다.
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`grid h-7 w-7 place-items-center rounded-control bg-canvas/90 text-ink-muted shadow-sm hover:bg-surface hover:text-ink ${FOCUS_RING}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full z-20 mt-1 w-36 overflow-hidden rounded-panel border border-border bg-canvas py-1 shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
                it.tone === "danger" ? "text-primary hover:bg-primary-soft" : "text-ink hover:bg-surface"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
