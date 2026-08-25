"use client";

import { useEffect, useState } from "react";
import {
  listProjectMembers,
  inviteProjectMember,
  removeProjectMember,
  updateProjectVisibility,
} from "@/lib/projects";
import { searchUsers, USER_SEARCH_MIN_LENGTH } from "@/lib/users";
import { errorMessage } from "@/lib/api";
import type {
  MemberStatus,
  Project,
  ProjectMember,
  UserSearchResult,
  Visibility,
} from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import {
  Button,
  ErrorBanner,
  Field,
  FOCUS_RING,
  Input,
  MemberStatusBadge,
  visibilityLabel,
} from "@/components/ui/primitives";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "public", label: "공개", hint: "로그인한 모든 사용자가 볼 수 있습니다." },
  { value: "invite", label: "초대", hint: "초대를 수락한 멤버만 볼 수 있습니다." },
  { value: "private", label: "비공개", hint: "소유자만 볼 수 있습니다." },
];

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 8;

const REMOVE_LABELS: Record<MemberStatus, string> = {
  pending: "초대 취소",
  active: "멤버 제거",
  rejected: "목록에서 지우기",
};

export function ProjectMembersDialog({
  project,
  isOwner,
  onClose,
  onVisibilityChanged,
}: {
  project: Project | null;
  isOwner: boolean;
  onClose: () => void;
  onVisibilityChanged: (updated: Project) => void;
}) {
  const open = project !== null;
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [removingId, setRemovingId] = useState<number | null>(null);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<Visibility | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listProjectMembers(String(project.id))
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "멤버 목록을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project?.id]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setPendingVisibility(null);
      setInviteOpen(false);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!inviteOpen || !project) return;
    const q = query.trim();
    if (q.length < USER_SEARCH_MIN_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchUsers(q, { limit: SEARCH_LIMIT, excludeProjectId: project.id })
        .then((list) => {
          if (!cancelled) setResults(list);
        })
        .catch((e) => {
          if (!cancelled) setError(errorMessage(e, "사용자 검색에 실패했습니다."));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, inviteOpen, project?.id]);

  async function handleInvite(user: UserSearchResult) {
    if (!project) return;
    setInvitingId(user.id);
    setError(null);
    try {
      const member = await inviteProjectMember(String(project.id), { user_id: user.id });
      setMembers((prev) => [...prev, member]);
      // 초대한 사람은 검색 결과에서 즉시 빼서 두 번 누르는 것을 막는다.
      setResults((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      setError(errorMessage(e, "멤버 초대에 실패했습니다."));
    } finally {
      setInvitingId(null);
    }
  }

  async function handleRemove(member: ProjectMember) {
    if (!project) return;
    setRemovingId(member.user_id);
    setError(null);
    try {
      await removeProjectMember(String(project.id), member.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    } catch (e) {
      setError(errorMessage(e, `${REMOVE_LABELS[member.status]}에 실패했습니다.`));
    } finally {
      setRemovingId(null);
    }
  }

  async function applyVisibility() {
    if (!project || pendingVisibility == null) return;
    setVisibilityBusy(true);
    setError(null);
    try {
      const updated = await updateProjectVisibility(String(project.id), pendingVisibility);
      setPendingVisibility(null);
      onVisibilityChanged(updated);
    } catch (e) {
      setError(errorMessage(e, "공개 범위 변경에 실패했습니다."));
    } finally {
      setVisibilityBusy(false);
    }
  }

  const canInvite = isOwner && project?.visibility === "invite";

  return (
    <Modal open={open} onClose={onClose} title="멤버 · 공개 범위" className="max-w-md">
      {project && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-xs font-medium text-ink">공개 범위</p>
            {isOwner ? (
              <div className="flex flex-col gap-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-2.5 rounded-control border border-border px-3 py-2 text-sm has-[:checked]:border-ink"
                  >
                    <input
                      type="radio"
                      name="visibility"
                      className="mt-0.5"
                      checked={(pendingVisibility ?? project.visibility) === opt.value}
                      disabled={visibilityBusy}
                      onChange={() =>
                        setPendingVisibility(opt.value === project.visibility ? null : opt.value)
                      }
                    />
                    <span>
                      <span className="block font-medium text-ink">{opt.label}</span>
                      <span className="block text-xs text-ink-muted">{opt.hint}</span>
                    </span>
                  </label>
                ))}
                {pendingVisibility != null && (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPendingVisibility(null)}
                      disabled={visibilityBusy}
                    >
                      되돌리기
                    </Button>
                    <Button variant="dark" onClick={applyVisibility} disabled={visibilityBusy}>
                      {visibilityBusy ? "적용 중…" : "공개 범위 적용"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink">{visibilityLabel(project.visibility)}</p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-ink">멤버</p>
              {canInvite && !inviteOpen && (
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className={`rounded-sm text-xs font-medium text-primary hover:underline ${FOCUS_RING}`}
                >
                  ＋ 멤버 초대
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-ink-muted">불러오는 중…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-ink-muted">등록된 멤버가 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {members.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-2 rounded-control border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-ink">{m.name || m.email}</span>
                      <span className="ml-1.5 text-xs text-ink-muted">
                        {m.role === "owner" ? "소유자" : "멤버"}
                      </span>
                    </span>
                    {/* 소유자는 항상 active라 뱃지가 정보를 주지 않는다. */}
                    {m.role !== "owner" && <MemberStatusBadge status={m.status} />}
                    {isOwner && m.role !== "owner" && (
                      <button
                        type="button"
                        onClick={() => handleRemove(m)}
                        disabled={removingId === m.user_id}
                        className={`shrink-0 rounded-sm text-xs text-primary hover:underline disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        {removingId === m.user_id ? "처리 중…" : REMOVE_LABELS[m.status]}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canInvite && inviteOpen && (
            <div className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-3">
              <Field
                label="멤버 초대"
                htmlFor="invite-search"
                hint="가입된 사용자만 초대할 수 있습니다."
              >
                <Input
                  id="invite-search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="이름 또는 이메일 (2자 이상)"
                />
              </Field>

              {query.trim().length >= USER_SEARCH_MIN_LENGTH &&
                (searching ? (
                  <p className="text-xs text-ink-muted">검색 중…</p>
                ) : results.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    초대할 수 있는 사용자가 없습니다. 이미 초대했거나 가입하지 않은 사용자입니다.
                  </p>
                ) : (
                  <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                    {results.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => handleInvite(u)}
                          disabled={invitingId != null}
                          className={`flex w-full items-center justify-between gap-2 rounded-control border border-border bg-canvas px-3 py-2 text-left text-sm transition-colors hover:border-ink disabled:opacity-50 ${FOCUS_RING}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">
                              {u.name || u.email}
                            </span>
                            {u.name && (
                              <span className="block truncate text-xs text-ink-muted">
                                {u.email}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs font-medium text-primary">
                            {invitingId === u.id ? "초대 중…" : "초대"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setInviteOpen(false);
                    setQuery("");
                    setResults([]);
                  }}
                >
                  초대 닫기
                </Button>
              </div>
            </div>
          )}

          {isOwner && project.visibility !== "invite" && (
            <p className="text-xs text-ink-muted">
              멤버 초대는 공개 범위가 <span className="font-medium text-ink">초대</span>일 때만
              쓰입니다.
            </p>
          )}

          {error && <ErrorBanner message={error} />}
        </div>
      )}
    </Modal>
  );
}
