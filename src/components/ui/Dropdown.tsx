"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FOCUS_RING } from "./primitives";

export type DropdownOption = {
  value: string;
  label: string;
  hint?: string;
};

const PANEL_MIN_WIDTH = 288;
const PANEL_MAX_WIDTH = 384;
const PANEL_EST_HEIGHT = 280;
const GAP = 6;
const MARGIN = 8;
const SEARCH_THRESHOLD = 8;

type Placement = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth: number;
  maxWidth: number;
};

/** 트리거 위치에서 패널을 놓을 자리를 잰다 — 아래 공간이 부족하면 위로, 오른쪽이 좁으면 우측 정렬. */
function place(rect: DOMRect): Placement {
  const flipUp =
    window.innerHeight - rect.bottom < PANEL_EST_HEIGHT && rect.top > PANEL_EST_HEIGHT;
  const roomRight = window.innerWidth - rect.left - MARGIN;
  const alignEnd = roomRight < PANEL_MIN_WIDTH;

  return {
    ...(flipUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    ...(alignEnd
      ? { right: Math.max(MARGIN, window.innerWidth - rect.right) }
      : { left: rect.left }),
    minWidth: rect.width,
    maxWidth: Math.min(PANEL_MAX_WIDTH, alignEnd ? rect.right - MARGIN : roomRight),
  };
}

export function Dropdown({
  value,
  options,
  onChange,
  label,
  variant = "field",
  placeholder = "선택",
  searchPlaceholder = "검색…",
  searchable,
  emptyLabel = "결과가 없습니다.",
  disabled = false,
  className = "",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  label: string;
  variant?: "chip" | "field";
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const active = variant === "chip" && options.length > 0 && value !== options[0].value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPlacement(place(rect));
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLElement>('[data-highlighted="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlacement(place(rect));
    setQuery("");
    setHighlight(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    requestAnimationFrame(() => {
      if (withSearch) searchRef.current?.focus();
      else panelRef.current?.focus();
    });
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function select(next: string) {
    onChange(next);
    close();
  }

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlight((h) => (h + step + filtered.length) % filtered.length);
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setHighlight(e.key === "Home" ? 0 : filtered.length - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[highlight];
      if (option) select(option.value);
    }
  }

  const triggerClass =
    variant === "chip"
      ? `inline-flex max-w-full items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
          active
            ? "border-primary/35 bg-primary-soft text-primary"
            : "border-border bg-canvas text-ink-muted hover:bg-surface hover:text-ink"
        }`
      : `flex w-full items-center justify-between gap-2 rounded-control border border-border bg-canvas px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

  return (
    <div className={variant === "chip" ? `max-w-full ${className}` : `w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openPanel();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={triggerClass}
      >
        {variant === "chip" ? (
          <span className="min-w-0 truncate">
            {active && selected ? (
              <>
                <span className="text-primary/70">{label}</span>
                <span aria-hidden> · </span>
                <span className="font-medium">{selected.label}</span>
              </>
            ) : (
              label
            )}
          </span>
        ) : (
          <span className={`min-w-0 truncate ${selected ? "" : "text-ink-muted"}`}>
            {selected?.label ?? placeholder}
          </span>
        )}
        <Chevron open={open} />
      </button>

      {open &&
        placement &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            style={{
              position: "fixed",
              top: placement.top,
              bottom: placement.bottom,
              left: placement.left,
              right: placement.right,
              minWidth: placement.minWidth,
              maxWidth: placement.maxWidth,
            }}
            className="z-50 overflow-hidden rounded-panel border border-border bg-canvas shadow-lg outline-none"
          >
            {withSearch && (
              <div className="border-b border-border p-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlight(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={`${label} 검색`}
                  className="w-full rounded-control bg-surface px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
            )}

            <div role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1">
              {filtered.map((option, i) => {
                const isSelected = option.value === value;
                const isHighlighted = i === highlight;
                return (
                  <button
                    key={option.value}
                    id={`${uid}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-highlighted={isHighlighted}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => select(option.value)}
                    className={`flex w-full items-start gap-2 rounded-control px-2.5 py-2 text-left text-sm ${
                      isHighlighted ? "bg-surface" : ""
                    } ${isSelected ? "text-primary" : "text-ink"}`}
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {option.label}
                      {option.hint && (
                        <span className="mt-0.5 block text-xs text-ink-muted">{option.hint}</span>
                      )}
                    </span>
                    {isSelected && <Check />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-2.5 py-6 text-center text-sm text-ink-muted">{emptyLabel}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-0.5 shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function FilterChipLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-muted">
      {children}
    </span>
  );
}
