"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { listProjects, createProject, updateProject, deleteProject } from "@/lib/projects";
import { errorMessage, isAuthError } from "@/lib/api";
import type { Project, Visibility } from "@/lib/types";
import {
  PageHeader,
  Card,
  Button,
  ErrorBanner,
  Field,
  Input,
  BackLink,
  VisibilityBadge,
} from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { LinkIconTile } from "@/components/ui/IconTile";
import { IconMenu } from "@/components/ui/IconMenu";
import { FolderTileIcon } from "@/components/ui/icons/FileTypeIcon";
import { ProjectMembersDialog } from "./ProjectMembersDialog";
import { ProjectInvitations } from "./ProjectInvitations";
import { useAuth } from "@/components/auth/AuthProvider";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "public", label: "공개", hint: "로그인한 모든 사용자가 볼 수 있습니다." },
  {
    value: "invite",
    label: "초대",
    hint: "초대를 수락한 멤버만 볼 수 있습니다. 생성 후 타일 메뉴의 “멤버 · 공개 범위”에서 초대하세요.",
  },
  { value: "private", label: "비공개", hint: "나만 볼 수 있습니다." },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ProjectsView() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [infoTarget, setInfoTarget] = useState<Project | null>(null);
  const [membersTarget, setMembersTarget] = useState<Project | null>(null);

  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  function isOwner(p: Project) {
    return user?.role === "admin" || p.owner_id === user?.id;
  }

  async function load() {
    setLoading(true);
    setError(null);
    setNeedLogin(false);
    try {
      setProjects(await listProjects());
    } catch (e) {
      setError(errorMessage(e, "프로젝트를 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  // 인증 세션(access token) 확인 후에 fetch해서, 새로고침 시 토큰 갱신과 경합해
  // "로그인 필요"가 잘못 깜빡이지 않게 한다.
  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading]);

  function openForm() {
    setName("");
    setDescription("");
    setVisibility("public");
    setFormError(null);
    setShowForm(true);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      setProjects((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (e) {
      setFormError(errorMessage(e, "프로젝트 생성에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    try {
      await deleteProject(String(target.id));
      setProjects((p) => p.filter((x) => x.id !== target.id));
      setDeleteTarget(null);
    } catch (e) {
      setError(errorMessage(e, "삭제에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  function startEditInfo() {
    if (!infoTarget) return;
    setEditName(infoTarget.name);
    setEditDescription(infoTarget.description ?? "");
    setEditError(null);
    setEditingInfo(true);
  }

  async function onSaveInfo(e: FormEvent) {
    e.preventDefault();
    if (!infoTarget || !editName.trim()) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateProject(String(infoTarget.id), {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setInfoTarget(updated);
      setEditingInfo(false);
    } catch (e) {
      setEditError(errorMessage(e, "수정에 실패했습니다."));
    } finally {
      setEditSubmitting(false);
    }
  }

  const q = query.trim().toLowerCase();
  const shown = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 pb-6">
      <div className="flex shrink-0 flex-col gap-3">
        <BackLink href="/">대시보드</BackLink>
        <PageHeader
          title="프로젝트"
          description="프로젝트별로 폴더와 문서를 구성하고 AI 기능을 적용합니다."
          actions={
            <Button variant="dark" onClick={openForm}>
              새 프로젝트
            </Button>
          }
        />
      </div>

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      <ProjectInvitations
        onAccepted={(project) =>
          setProjects((prev) =>
            prev.some((p) => p.id === project.id) ? prev : [project, ...prev],
          )
        }
      />

      {/* 파인더 창: 페이지 남은 공간을 꽉 채우고, 목록만 내부에서 스크롤된다 */}
      <Card className="flex min-h-[420px] flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.push("/")}
              aria-label="대시보드로"
              title="대시보드로"
              className="h-3 w-3 rounded-full bg-[#ff5f57] transition-[filter] hover:brightness-90"
            />
            <span aria-hidden className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span aria-hidden className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>

          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">프로젝트</span>

          <div className="relative w-32 shrink-0 sm:w-48">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색"
              aria-label="프로젝트 검색"
              className="w-full rounded-full border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">불러오는 중…</div>
          ) : shown.length === 0 && !error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-ink">
                {q ? "검색 결과가 없습니다." : "아직 프로젝트가 없습니다."}
              </p>
              {!q && <p className="text-xs text-ink-muted">＋ 새 프로젝트로 시작하세요.</p>}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {shown.map((p) => (
                  <LinkIconTile
                    key={p.id}
                    href={`/projects/${p.id}`}
                    icon={<FolderTileIcon size={44} />}
                    label={p.name}
                    sublabel={<VisibilityBadge visibility={p.visibility} />}
                    menu={
                      <IconMenu
                        ariaLabel={`${p.name} 프로젝트 메뉴`}
                        items={[
                          { key: "info", label: "정보", onSelect: () => setInfoTarget(p) },
                          {
                            key: "rename",
                            label: "이름 · 설명 수정",
                            onSelect: () => {
                              setInfoTarget(p);
                              setEditName(p.name);
                              setEditDescription(p.description ?? "");
                              setEditError(null);
                              setEditingInfo(true);
                            },
                          },
                          {
                            key: "members",
                            label: "멤버 · 공개 범위",
                            onSelect: () => setMembersTarget(p),
                          },
                          ...(isOwner(p)
                            ? [
                                {
                                  key: "delete",
                                  label: "삭제",
                                  tone: "danger" as const,
                                  onSelect: () => setDeleteTarget(p),
                                },
                              ]
                            : []),
                        ]}
                      />
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="새 프로젝트"
        className="max-w-md"
      >
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <Field label="프로젝트 이름" htmlFor="project-name">
            <Input
              id="project-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2026 상반기 사업계획"
            />
          </Field>
          <Field label="설명" htmlFor="project-description" hint="선택 항목입니다.">
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 프로젝트가 다루는 문서를 한 줄로"
            />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink">공개 범위</p>
            <div className="flex gap-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-control border border-border px-2 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-surface"
                >
                  <input
                    type="radio"
                    name="new-project-visibility"
                    className="sr-only"
                    checked={visibility === opt.value}
                    onChange={() => setVisibility(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}
            </p>
          </div>
          {formError && <ErrorBanner message={formError} needLogin={needLogin} />}
          <div className="mt-1 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              취소
            </Button>
            <Button type="submit" variant="dark" disabled={submitting || !name.trim()}>
              {submitting ? "생성 중…" : "생성"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="프로젝트 삭제"
        message={`"${deleteTarget?.name}" 프로젝트를 삭제할까요? 되돌릴 수 없습니다.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />

      <Modal
        open={infoTarget !== null}
        onClose={() => {
          setInfoTarget(null);
          setEditingInfo(false);
        }}
        title={editingInfo ? "이름 · 설명 수정" : "프로젝트 정보"}
        className="max-w-sm"
      >
        {infoTarget && editingInfo ? (
          <form onSubmit={onSaveInfo} className="flex flex-col gap-4">
            <Field label="프로젝트 이름" htmlFor="project-edit-name">
              <Input
                id="project-edit-name"
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Field>
            <Field label="설명" htmlFor="project-edit-description" hint="선택 항목입니다.">
              <Input
                id="project-edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </Field>
            {editError && <ErrorBanner message={editError} />}
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingInfo(false)}>
                취소
              </Button>
              <Button type="submit" variant="dark" disabled={editSubmitting || !editName.trim()}>
                {editSubmitting ? "저장 중…" : "저장"}
              </Button>
            </div>
          </form>
        ) : (
          infoTarget && (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-ink-muted">이름</dt>
                <dd className="text-ink">{infoTarget.name}</dd>
                <dt className="text-ink-muted">설명</dt>
                <dd className="text-ink">{infoTarget.description || "설명 없음"}</dd>
                <dt className="text-ink-muted">공개 범위</dt>
                <dd className="text-ink">
                  <VisibilityBadge visibility={infoTarget.visibility} />
                </dd>
                <dt className="text-ink-muted">생성일</dt>
                <dd className="text-ink">{fmtDate(infoTarget.created_at)}</dd>
              </dl>
              <div className="flex justify-end">
                <Button variant="outline" onClick={startEditInfo}>
                  이름 · 설명 수정
                </Button>
              </div>
            </div>
          )
        )}
      </Modal>

      <ProjectMembersDialog
        project={membersTarget}
        isOwner={membersTarget ? isOwner(membersTarget) : false}
        onClose={() => setMembersTarget(null)}
        onVisibilityChanged={(updated) => {
          setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setMembersTarget(updated);
        }}
      />
    </div>
  );
}
