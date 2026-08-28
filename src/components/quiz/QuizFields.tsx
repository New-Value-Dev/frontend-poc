"use client";

import { useEffect, useState } from "react";
import { Button, FOCUS_RING } from "@/components/ui/primitives";
import { SearchInput } from "@/components/ui/FilterBar";
import { searchUsers, USER_SEARCH_MIN_LENGTH } from "@/lib/users";
import type { ProjectMember, UserSearchResult } from "@/lib/types";

/** 문제집 응시자로 지정된(또는 지정 예정인) 사용자 하나 */
export type SelectedAssignee = { user_id: number; name: string | null; email: string };

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

export function AssigneePicker({
  members,
  selectedUserIds,
  onToggle,
  disabled = false,
  query,
  onQueryChange,
}: {
  members: ProjectMember[];
  selectedUserIds: number[];
  onToggle: (member: ProjectMember) => void;
  disabled?: boolean;
  query: string;
  onQueryChange: (v: string) => void;
}) {
  const keyword = query.trim().toLowerCase();
  const visible = keyword
    ? members.filter(
        (m) =>
          (m.name ?? "").toLowerCase().includes(keyword) ||
          m.email.toLowerCase().includes(keyword),
      )
    : members;

  return (
    <div className="flex flex-col gap-2.5">
      {members.length > 8 && (
        <SearchInput value={query} onChange={onQueryChange} placeholder="이름·이메일 검색…" />
      )}
      <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
        {visible.map((m) => (
          <label
            key={m.user_id}
            className={`flex items-start gap-2 rounded-control px-1.5 py-1.5 text-sm text-ink ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedUserIds.includes(m.user_id)}
              disabled={disabled}
              onChange={() => onToggle(m)}
              className={`mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)] ${FOCUS_RING}`}
            />
            <span className="min-w-0 break-words">
              {m.name ?? m.email}
              {m.name && <span className="ml-1 text-xs text-ink-muted">{m.email}</span>}
            </span>
          </label>
        ))}
        {members.length === 0 && (
          <p className="text-xs text-ink-muted">이 프로젝트에 활성 멤버가 없습니다.</p>
        )}
        {members.length > 0 && visible.length === 0 && (
          <p className="text-xs text-ink-muted">이름이 맞는 멤버가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

export function AssigneeSearchPicker({
  selected,
  onAdd,
  onRemove,
  disabled = false,
}: {
  selected: SelectedAssignee[];
  onAdd: (user: SelectedAssignee) => void;
  onRemove: (userId: number) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < USER_SEARCH_MIN_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchUsers(q, { limit: 8 })
        .then((list) => {
          if (!cancelled) setResults(list);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const selectedIds = new Set(selected.map((u) => u.user_id));
  const candidates = results.filter((u) => !selectedIds.has(u.id));

  return (
    <div className="flex flex-col gap-2.5">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <li
              key={u.user_id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink"
            >
              <span>{u.name ?? u.email}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(u.user_id)}
                  aria-label={`${u.name ?? u.email} 응시자에서 제외`}
                  className={`text-ink-muted hover:text-ink ${FOCUS_RING}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {selected.length === 0 && disabled && (
        <p className="text-xs text-ink-muted">지정된 응시자가 없습니다.</p>
      )}
      {!disabled && (
        <>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="이름·이메일로 검색해서 추가 (2자 이상)…"
          />
          {query.trim().length >= USER_SEARCH_MIN_LENGTH &&
            (searching ? (
              <p className="text-xs text-ink-muted">검색 중…</p>
            ) : (
              <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                {candidates.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onAdd({ user_id: u.id, name: u.name, email: u.email });
                        setQuery("");
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-control px-1.5 py-1.5 text-left text-sm hover:bg-surface ${FOCUS_RING}`}
                    >
                      <span className="min-w-0 break-words">
                        {u.name ?? u.email}
                        {u.name && <span className="ml-1 text-xs text-ink-muted">{u.email}</span>}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-primary">추가</span>
                    </button>
                  </li>
                ))}
                {results.length > 0 && candidates.length === 0 && (
                  <p className="text-xs text-ink-muted">검색된 사용자를 모두 지정했습니다.</p>
                )}
                {results.length === 0 && (
                  <p className="text-xs text-ink-muted">일치하는 사용자가 없습니다.</p>
                )}
              </ul>
            ))}
        </>
      )}
    </div>
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

export function ManageOnlyNotice() {
  return (
    <p className="rounded-control bg-surface p-3 text-xs leading-relaxed text-ink-muted">
      문제집을 만든 사람만 수정할 수 있습니다.
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
