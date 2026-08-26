"use client";

import { Button, FOCUS_RING } from "@/components/ui/primitives";

/** 문제집 설정의 불리언 옵션 — 생성 모달과 설정 탭이 공유한다. */
export function QuizToggleField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-control px-1 py-1.5 text-sm text-ink ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-4 w-4 accent-[var(--color-primary)] ${FOCUS_RING}`}
      />
      {label}
    </label>
  );
}

export function LockNotice() {
  return (
    <p className="rounded-control bg-surface p-3 text-xs leading-relaxed text-ink-muted">
      누군가 이 문제집을 응시하면 모든 응시자가 같은 버전을 보도록 설정과 문제 구성이 잠깁니다.
      그 뒤에는 <span className="font-medium text-ink">복제해서 편집</span>해야 합니다.
    </p>
  );
}

export function LockedBanner({
  onDuplicate,
  busy,
}: {
  onDuplicate: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-surface p-4">
      <p className="text-sm text-ink-muted">
        🔒 응시 이력이 있어 설정과 문제 구성을 수정할 수 없습니다. 복제하면 자유롭게 편집할 수 있는
        새 문제집이 만들어집니다.
      </p>
      <Button onClick={onDuplicate} disabled={busy}>
        {busy ? "복제 중…" : "복제해서 편집"}
      </Button>
    </div>
  );
}
