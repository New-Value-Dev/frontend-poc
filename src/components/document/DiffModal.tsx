"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDocumentDiff } from "@/lib/diff";
import { errorMessage } from "@/lib/api";
import type { DiffResult, DiffToken, SectionDiff } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { FOCUS_RING } from "@/components/ui/primitives";

type ChangeOp = "added" | "deleted" | "modified";

const CHANGE_CHIPS: Record<ChangeOp, { label: string; active: string; inactive: string }> = {
  added: { label: "추가", active: "bg-emerald-100 text-emerald-800", inactive: "bg-surface-2 text-ink-muted" },
  deleted: { label: "삭제", active: "bg-primary-soft text-primary", inactive: "bg-surface-2 text-ink-muted" },
  modified: { label: "수정", active: "bg-sky-100 text-sky-800", inactive: "bg-surface-2 text-ink-muted" },
};

function sideTokens(tokens: DiffToken[], side: "from" | "to") {
  const keep = side === "from" ? "delete" : "insert";
  return tokens.filter((t) => t.op === "equal" || t.op === keep);
}

function TokenText({ tokens, side }: { tokens: DiffToken[]; side: "from" | "to" }) {
  const kept = sideTokens(tokens, side);
  if (kept.length === 0) return <span className="text-ink-muted">—</span>;
  return (
    <>
      {kept.map((t, i) =>
        t.op === "equal" ? (
          <span key={i}>{t.text}</span>
        ) : (
          <span
            key={i}
            className={t.op === "delete" ? "bg-primary-soft text-primary" : "bg-emerald-100 text-emerald-800"}
          >
            {t.text}
          </span>
        ),
      )}
    </>
  );
}

function SectionRow({
  section,
  focused,
  registerRef,
}: {
  section: SectionDiff;
  focused: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const fromEmpty = section.op === "added";
  const toEmpty = section.op === "deleted";
  return (
    <div
      ref={registerRef}
      className={`grid grid-cols-2 border-b border-border transition-shadow last:border-b-0 ${
        focused ? "relative z-10 outline outline-2 -outline-offset-2 outline-sky-400" : ""
      }`}
    >
      <div
        className={`whitespace-pre-wrap border-r border-border bg-surface-2/30 p-3 text-sm leading-relaxed ${
          fromEmpty ? "bg-surface-2/60" : section.op === "deleted" ? "bg-primary-soft/25" : ""
        }`}
      >
        {!fromEmpty && section.title && (
          <p className="mb-1 text-xs font-semibold text-ink-muted">{section.title}</p>
        )}
        <TokenText tokens={section.tokens} side="from" />
      </div>
      <div
        className={`whitespace-pre-wrap bg-canvas p-3 text-sm leading-relaxed ${
          toEmpty ? "bg-surface-2/60" : section.op === "added" ? "bg-emerald-50/50" : ""
        }`}
      >
        {!toEmpty && section.title && (
          <p className="mb-1 text-xs font-semibold text-ink-muted">{section.title}</p>
        )}
        <TokenText tokens={section.tokens} side="to" />
      </div>
    </div>
  );
}

export function DiffModal({
  open,
  onClose,
  docId,
  fromVersionId,
  toVersionId,
}: {
  open: boolean;
  onClose: () => void;
  docId: string;
  fromVersionId: number;
  toVersionId: number;
}) {
  const [result, setResult] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeOps, setActiveOps] = useState<Set<ChangeOp>>(new Set(["added", "deleted", "modified"]));
  const [focusPos, setFocusPos] = useState(-1); // changeIndices 안에서의 위치
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setFocusPos(-1);
    getDocumentDiff(docId, fromVersionId, toVersionId)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "버전 비교에 실패했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, docId, fromVersionId, toVersionId]);

  const changeIndices = useMemo(() => {
    if (!result) return [];
    return result.sections
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => activeOps.has(s.op as ChangeOp))
      .map(({ i }) => i);
  }, [result, activeOps]);

  function toggleOp(op: ChangeOp) {
    setActiveOps((prev) => {
      const next = new Set(prev);
      if (next.has(op)) next.delete(op);
      else next.add(op);
      return next;
    });
    setFocusPos(-1);
  }

  function goTo(delta: 1 | -1) {
    if (changeIndices.length === 0) return;
    const next = focusPos === -1 ? 0 : (focusPos + delta + changeIndices.length) % changeIndices.length;
    setFocusPos(next);
    sectionRefs.current[changeIndices[next]]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const focusedSectionIndex = focusPos === -1 ? -1 : changeIndices[focusPos];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? `버전 비교 · V${result.from_version.version_no} → V${result.to_version.version_no}` : "버전 비교"}
      className="max-w-5xl"
    >
      {loading && (
        <div className="flex flex-col items-center gap-2 py-16 text-sm text-ink-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
          비교하는 중…
        </div>
      )}
      {!loading && error && <p className="py-8 text-center text-sm text-primary">{error}</p>}
      {!loading && !error && result && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(Object.keys(CHANGE_CHIPS) as ChangeOp[]).map((op) => {
              const on = activeOps.has(op);
              return (
                <button
                  key={op}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleOp(op)}
                  className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${FOCUS_RING} ${
                    on ? CHANGE_CHIPS[op].active : CHANGE_CHIPS[op].inactive
                  }`}
                >
                  {CHANGE_CHIPS[op].label} {result.summary[op]}
                </button>
              );
            })}
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-medium text-ink-muted">
              변경 없음 {result.summary.unchanged}
            </span>

            <div className="ml-auto flex items-center gap-1">
              <span className="mr-1 text-ink-muted">
                {changeIndices.length === 0 ? "0 / 0" : `${focusPos + 1} / ${changeIndices.length}`}
              </span>
              <button
                type="button"
                onClick={() => goTo(-1)}
                disabled={changeIndices.length === 0}
                aria-label="이전 변경으로 이동"
                className={`rounded-control border border-border px-2 py-1 text-ink-muted hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => goTo(1)}
                disabled={changeIndices.length === 0}
                aria-label="다음 변경으로 이동"
                className={`rounded-control border border-border px-2 py-1 text-ink-muted hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
              >
                ↓
              </button>
            </div>
          </div>

          <div className="max-h-[65vh] overflow-y-auto rounded-control border border-border">
            <div className="sticky top-0 z-20 grid grid-cols-2 border-b border-border text-xs font-semibold text-ink-muted">
              <div className="flex items-center gap-1.5 border-r border-border bg-surface-2 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                이전 · V{result.from_version.version_no}
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" aria-hidden />
                이후 · V{result.to_version.version_no}
              </div>
            </div>
            {result.sections.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-muted">비교할 섹션이 없습니다.</p>
            ) : (
              result.sections.map((s, i) => (
                <SectionRow
                  key={`${s.from_section_id}-${s.to_section_id}-${i}`}
                  section={s}
                  focused={i === focusedSectionIndex}
                  registerRef={(el) => {
                    sectionRefs.current[i] = el;
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
