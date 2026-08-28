"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FOCUS_RING, Select } from "./primitives";

const PANEL_WIDTH = 296;
const PANEL_EST_HEIGHT = 400;
const GAP = 6;
const MARGIN = 8;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Placement = { top?: number; bottom?: number; left?: number; right?: number };

function place(rect: DOMRect): Placement {
  const flipUp = window.innerHeight - rect.bottom < PANEL_EST_HEIGHT && rect.top > PANEL_EST_HEIGHT;
  const roomRight = window.innerWidth - rect.left - MARGIN;
  const alignEnd = roomRight < PANEL_WIDTH;
  return {
    ...(flipUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    ...(alignEnd
      ? { right: Math.max(MARGIN, window.innerWidth - rect.right) }
      : { left: rect.left }),
  };
}

function parseLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm));
}

function formatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(d: Date): string {
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function DateTimePicker({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = "선택 안 함",
  className = "",
}: {
  id?: string;
  /** `YYYY-MM-DDTHH:mm` — 빈 문자열이면 선택 안 함 */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => (value ? parseLocal(value) : null), [value]);
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date());
  const [hour, setHour] = useState(selected?.getHours() ?? 9);
  const [minute, setMinute] = useState(selected?.getMinutes() ?? 0);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewMonth(selected ?? new Date());
    setHour(selected?.getHours() ?? 9);
    setMinute(selected?.getMinutes() ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPlacement(place(rect));
    };
    update();
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

  function pickDay(day: Date) {
    onChange(formatLocal(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)));
  }

  function changeHour(h: number) {
    setHour(h);
    if (selected) onChange(formatLocal(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), h, minute)));
  }

  function changeMinute(m: number) {
    setMinute(m);
    if (selected) onChange(formatLocal(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), hour, m)));
  }

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const today = new Date();

  return (
    <div className={`w-full ${className}`}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-control border border-border bg-canvas px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
      >
        <span className={`min-w-0 truncate tnum ${selected ? "" : "text-ink-muted"}`}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <CalendarIcon />
      </button>

      {open &&
        placement &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: placement.top,
              bottom: placement.bottom,
              left: placement.left,
              right: placement.right,
              width: PANEL_WIDTH,
            }}
            className="z-50 overflow-hidden rounded-panel border border-border bg-canvas shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <button
                type="button"
                onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                aria-label="이전 달"
                className={`rounded-control p-1 text-ink-muted hover:bg-surface hover:text-ink ${FOCUS_RING}`}
              >
                <ChevronIcon direction="left" />
              </button>
              <span className="text-sm font-medium text-ink">
                {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                aria-label="다음 달"
                className={`rounded-control p-1 text-ink-muted hover:bg-surface hover:text-ink ${FOCUS_RING}`}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>

            <div className="grid grid-cols-7 px-3 pt-2.5 text-center text-xs text-ink-muted">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 px-3 pb-2.5 pt-1.5">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1);
                const isSelected = selected != null && sameDay(day, selected);
                const isToday = sameDay(day, today);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pickDay(day)}
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs tnum ${FOCUS_RING} ${
                      isSelected
                        ? "bg-primary font-medium text-white"
                        : isToday
                          ? "font-medium text-primary"
                          : "text-ink hover:bg-surface"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
              <Select
                value={hour}
                onChange={(e) => changeHour(Number(e.target.value))}
                disabled={!selected}
                aria-label="시"
                className="w-full"
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}시
                  </option>
                ))}
              </Select>
              <Select
                value={minute}
                onChange={(e) => changeMinute(Number(e.target.value))}
                disabled={!selected}
                aria-label="분"
                className="w-full"
              >
                {Array.from({ length: 60 }).map((_, m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}분
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={`rounded-control px-2 py-1 text-xs text-ink-muted hover:bg-surface hover:text-ink ${FOCUS_RING}`}
              >
                지우기
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`rounded-control px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft ${FOCUS_RING}`}
              >
                확인
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-ink-muted"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
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
    >
      <path d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}
