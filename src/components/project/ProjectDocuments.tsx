"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProject, listFolders, createFolder, updateFolder, deleteFolder, reorderFolder } from "@/lib/projects";
import { listDocuments, uploadDocument, deleteDocument, moveDocument } from "@/lib/documents";
import { getVersionStatus } from "@/lib/versions";
import { errorMessage, isAuthError } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import type { Project, Folder, Document } from "@/lib/types";
import {
  PageHeader,
  Card,
  Button,
  StatusBadge,
  ErrorBanner,
  BackLink,
  VisibilityBadge,
} from "@/components/ui/primitives";
import { ConfirmDialog, PromptDialog } from "@/components/ui/Modal";
import { IconMenu } from "@/components/ui/IconMenu";
import { FileTypeIcon, FolderTileIcon } from "@/components/ui/icons/FileTypeIcon";
import { UploadDialog, type UploadInput } from "./UploadDialog";
import { FolderTree, folderPath, DOCUMENT_DRAG_TYPE } from "./FolderTree";
import { DocumentInfoDialog } from "./DocumentInfoDialog";
import { MoveDocumentDialog } from "./MoveDocumentDialog";
import { ProjectMembersDialog } from "./ProjectMembersDialog";
import { useAuth } from "@/components/auth/AuthProvider";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMPTY = "-";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function ProjectDocuments({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 모달 상태
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<Folder | null>(null);
  const [folderDeleteBusy, setFolderDeleteBusy] = useState(false);
  const [infoTarget, setInfoTarget] = useState<Document | null>(null);
  const [moveTarget, setMoveTarget] = useState<Document | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setNeedLogin(false);
    // 서로 독립적으로 로드해서 project-meta/folders 실패가 문서 목록을 지우지 않게 한다 (역도 마찬가지).
    const [projR, folR, docR] = await Promise.allSettled([
      getProject(projectId),
      listFolders(projectId),
      listDocuments(projectId),
    ]);
    if (projR.status === "fulfilled") setProject(projR.value);
    if (folR.status === "fulfilled") setFolders(folR.value);
    if (docR.status === "fulfilled") setDocuments(docR.value);

    // 주요 콘텐츠인 문서 목록이 실패했을 때만 에러를 노출한다.
    if (docR.status === "rejected") {
      setError(errorMessage(docR.reason, "문서를 불러오지 못했습니다."));
      setNeedLogin(isAuthError(docR.reason));
    }
    setLoading(false);
  }

  const { user, loading: authLoading } = useAuth();
  const isOwner = project != null && (user?.role === "admin" || project.owner_id === user?.id);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, authLoading]);

  /** 버전의 처리 상태를 폴링하며 해당 행에 반영한다. */
  async function pollVersion(documentId: number, versionId: number) {
    for (let i = 0; i < 12; i++) {
      await sleep(2000);
      try {
        const s = await getVersionStatus(versionId);
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === documentId && d.current_version
              ? { ...d, current_version: { ...d.current_version, processing_status: s.status } }
              : d,
          ),
        );
        // 파이프라인은 현재 CHUNKED에서 멈춘다 (embedding은 Phase 9).
        if (s.status === "READY" || s.status === "FAILED" || s.status === "CHUNKED") return;
      } catch {
        return;
      }
    }
  }

  async function handleUpload({ file, name, folderId, description }: UploadInput) {
    setUploading(true);
    setError(null);
    try {
      const res = await uploadDocument(projectId, file, {
        name,
        folder_id: folderId ?? undefined,
        description,
      });
      // 상태 배지가 파이프라인을 제대로 반영하도록 current_version이 존재하게 보정한다.
      const doc = res.document.current_version
        ? res.document
        : { ...res.document, current_version: res.version };
      setDocuments((prev) => [doc, ...prev]);
      setUploadOpen(false);
      void pollVersion(doc.id, res.version.id);
    } catch (e) {
      setError(errorMessage(e, "업로드에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    try {
      await deleteDocument(String(target.id));
      setDocuments((d) => d.filter((x) => x.id !== target.id));
      setDeleteTarget(null);
    } catch (e) {
      setError(errorMessage(e, "삭제에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function createNewFolder(name: string) {
    setFolderBusy(true);
    try {
      const f = await createFolder(projectId, {
        name,
        parent_id: activeFolder ?? undefined,
      });
      setFolders((prev) => [...prev, f]);
      setFolderDialog(false);
    } catch (e) {
      setError(errorMessage(e, "폴더 생성에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleInlineRename(folder: Folder, name: string) {
    try {
      const updated = await updateFolder(String(folder.id), { name });
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, name: updated.name } : f)));
    } catch (e) {
      setError(errorMessage(e, "폴더 이름 변경에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    }
  }

  async function confirmDeleteFolder() {
    if (!folderDeleteTarget) return;
    const id = folderDeleteTarget.id;
    setFolderDeleteBusy(true);
    try {
      await deleteFolder(String(id));
      if (activeFolder === id) goToFolder(null);
      // 재동기화 — 폴더 삭제로 그 안의 문서는 미분류가 된다 (folder_id → null).
      const [f, d] = await Promise.all([listFolders(projectId), listDocuments(projectId)]);
      setFolders(f);
      setDocuments(d);
      setFolderDeleteTarget(null);
    } catch (e) {
      setError(errorMessage(e, "폴더 삭제에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setFolderDeleteBusy(false);
    }
  }

  async function handleFolderReorder(folderId: number, parentId: number | null, targetIndex: number) {
    try {
      const updated = await reorderFolder(String(folderId), { parent_id: parentId, target_index: targetIndex });
      const byId = new Map(updated.map((f) => [f.id, f]));
      setFolders((prev) => prev.map((f) => byId.get(f.id) ?? f));
    } catch (e) {
      setError(errorMessage(e, "폴더 순서 변경에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    }
  }

  async function handleDropDocument(documentId: number, folderId: number | null) {
    try {
      const moved = await moveDocument(String(documentId), { folder_id: folderId });
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? moved : d)));
    } catch (e) {
      setError(errorMessage(e, "문서 이동에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    }
  }

  function handleDocumentMoved(moved: Document, targetProjectId: number) {
    setMoveTarget(null);
    if (targetProjectId !== Number(projectId)) {
      setDocuments((prev) => prev.filter((d) => d.id !== moved.id));
    } else {
      setDocuments((prev) => prev.map((d) => (d.id === moved.id ? moved : d)));
    }
  }

  // 현재 폴더의 "직계 자식"만 (OS 디렉토리처럼) — 하위 폴더는 행 클릭으로 드릴다운한다.
  const childFolders = useMemo(
    () => folders.filter((f) => f.parent_id === activeFolder).sort((a, b) => a.rank - b.rank),
    [folders, activeFolder],
  );
  const childDocs = useMemo(
    () => documents.filter((d) => d.folder_id === activeFolder),
    [documents, activeFolder],
  );

  /** 폴더 이동 시 이전 검색어가 새 폴더에도 남아있지 않게 함께 초기화. */
  function goToFolder(id: number | null) {
    setQuery("");
    setActiveFolder(id);
  }

  const q = query.trim().toLowerCase();
  const shownFolders = q ? childFolders.filter((f) => f.name.toLowerCase().includes(q)) : childFolders;
  const shownDocs = q ? childDocs.filter((d) => d.name.toLowerCase().includes(q)) : childDocs;

  if (loading) {
    return <ProjectDocumentsSkeleton />;
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 pb-6">
      <div className="flex shrink-0 flex-col gap-3">
        <BackLink href="/projects">프로젝트</BackLink>
        <PageHeader
          title={project?.name ?? `프로젝트 #${projectId}`}
          titleBadge={project && <VisibilityBadge visibility={project.visibility} />}
          description={`문서 ${documents.length}개`}
          actions={
            <>
              {project && (
                <Button variant="outline" onClick={() => setMembersOpen(true)}>
                  멤버
                </Button>
              )}
              <Button variant="dark" onClick={() => setUploadOpen(true)}>
                문서 업로드
              </Button>
            </>
          }
        />
      </div>

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      {/* 파인더 창: 페이지 남은 공간을 꽉 채우고, 그 안의 사이드바/리스트가 각자 스크롤된다 */}
      <Card className="flex min-h-[420px] flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.push("/projects")}
              aria-label="프로젝트 목록으로"
              title="프로젝트 목록으로"
              className="h-3 w-3 rounded-full bg-[#ff5f57] transition-[filter] hover:brightness-90"
            />
            <span aria-hidden className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span aria-hidden className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>

          <nav
            aria-label="현재 위치"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm text-ink-muted"
          >
            <button
              type="button"
              onClick={() => goToFolder(null)}
              className={activeFolder == null ? "font-medium text-ink" : "hover:text-ink"}
            >
              {project?.name ?? "프로젝트"}
            </button>
            {folderPath(activeFolder, folders).map((f, i, arr) => (
              <span key={f.id} className="flex items-center gap-1">
                <span aria-hidden className="text-ink-muted/60">
                  /
                </span>
                <button
                  type="button"
                  onClick={() => goToFolder(f.id)}
                  className={i === arr.length - 1 ? "font-medium text-ink" : "hover:text-ink"}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </nav>

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
              aria-label="현재 폴더에서 검색"
              className="w-full rounded-full border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* 폴더 사이드바 — 내용이 넘치면 이 안에서만 스크롤 */}
          <div className="shrink-0 overflow-y-auto border-b border-border lg:w-56 lg:border-b-0 lg:border-r">
            <FolderTree
              folders={folders}
              activeId={activeFolder}
              onSelect={goToFolder}
              onNew={() => setFolderDialog(true)}
              onRename={handleInlineRename}
              onDelete={setFolderDeleteTarget}
              onReorder={handleFolderReorder}
              onDropDocument={handleDropDocument}
            />
          </div>

          {/* 파일 리스트 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">불러오는 중…</div>
            ) : shownFolders.length === 0 && shownDocs.length === 0 && !error ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-medium text-ink">
                  {q
                    ? "검색 결과가 없습니다."
                    : activeFolder == null
                      ? "문서가 없습니다."
                      : "이 폴더가 비어 있습니다."}
                </p>
                {!q && <p className="text-xs text-ink-muted">＋ 문서 업로드로 시작하세요.</p>}
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2 text-xs text-ink-muted">
                  <span className="flex-1">이름</span>
                  <span className="hidden w-20 shrink-0 sm:block">상태</span>
                  <span className="hidden w-16 shrink-0 text-right md:block">크기</span>
                  <span className="hidden w-24 shrink-0 text-right lg:block">생성일</span>
                  <span className="w-7 shrink-0" aria-hidden />
                </div>
                {/* 파일 목록만 스크롤되고, 위 타이틀바/경로/열 헤더는 고정된다 */}
                <div className="flex-1 overflow-y-auto">
                {shownFolders.map((f) => (
                  <div
                    key={`folder-${f.id}`}
                    className="group relative z-0 flex items-center gap-3 border-b border-border px-4 py-2 last:border-b-0 hover:bg-surface has-[[aria-expanded=true]]:z-20"
                  >
                    <button
                      type="button"
                      onClick={() => goToFolder(f.id)}
                      aria-label={f.name}
                      className="absolute inset-0 z-0"
                    />
                    <span className="pointer-events-none flex min-w-0 flex-1 items-center gap-2.5">
                      <FolderTileIcon size={20} className="shrink-0" />
                      <span className="truncate text-sm text-ink">{f.name}</span>
                    </span>
                    <span className="hidden w-20 shrink-0 text-xs text-ink-muted sm:block">{EMPTY}</span>
                    <span className="hidden w-16 shrink-0 text-right text-xs text-ink-muted md:block">{EMPTY}</span>
                    <span className="hidden w-24 shrink-0 text-right text-xs text-ink-muted lg:block">
                      {fmtDate(f.created_at)}
                    </span>
                    <span className="z-10 w-7 shrink-0">
                      <IconMenu
                        ariaLabel={`${f.name} 폴더 메뉴`}
                        items={[
                          { key: "delete", label: "삭제", tone: "danger", onSelect: () => setFolderDeleteTarget(f) },
                        ]}
                      />
                    </span>
                  </div>
                ))}
                {shownDocs.map((d) => (
                  <div
                    key={`doc-${d.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DOCUMENT_DRAG_TYPE, String(d.id));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="group relative z-0 flex items-center gap-3 border-b border-border px-4 py-2 last:border-b-0 hover:bg-surface has-[[aria-expanded=true]]:z-20"
                  >
                    <Link href={`/documents/${d.id}`} aria-label={d.name} className="absolute inset-0 z-0" />
                    <span className="pointer-events-none flex min-w-0 flex-1 items-center gap-2.5">
                      <FileTypeIcon fileName={d.current_version?.original_file_name} size={20} className="shrink-0" />
                      <span className="truncate text-sm text-ink">{d.name}</span>
                    </span>
                    <span className="hidden w-20 shrink-0 sm:block">
                      {/* 버전이 없으면 UPLOADED로 본다 — 백엔드 RecentDocumentRead와 같은 규칙. */}
                      <StatusBadge status={d.current_version?.processing_status ?? "UPLOADED"} />
                    </span>
                    <span className="hidden w-16 shrink-0 text-right text-xs text-ink-muted md:block">
                      {formatFileSize(d.current_version?.file_size)}
                    </span>
                    <span className="hidden w-24 shrink-0 text-right text-xs text-ink-muted lg:block">
                      {fmtDate(d.created_at)}
                    </span>
                    <span className="z-10 w-7 shrink-0">
                      <IconMenu
                        ariaLabel={`${d.name} 문서 메뉴`}
                        items={[
                          { key: "info", label: "정보", onSelect: () => setInfoTarget(d) },
                          { key: "move", label: "이동", onSelect: () => setMoveTarget(d) },
                          { key: "delete", label: "삭제", tone: "danger", onSelect: () => setDeleteTarget(d) },
                        ]}
                      />
                    </span>
                  </div>
                ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {uploadOpen && (
        <UploadDialog
          open
          folders={folders}
          defaultFolderId={activeFolder}
          busy={uploading}
          onCancel={() => setUploadOpen(false)}
          onUpload={handleUpload}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="문서 삭제"
        message={`"${deleteTarget?.name}" 문서를 삭제할까요? 되돌릴 수 없습니다.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />

      <PromptDialog
        open={folderDialog}
        title="새 폴더"
        label={activeFolder != null ? "선택한 폴더 하위에 생성됩니다." : "최상위에 생성됩니다."}
        placeholder="폴더 이름"
        submitVariant="dark"
        onSubmit={createNewFolder}
        onCancel={() => setFolderDialog(false)}
        busy={folderBusy}
      />

      <ConfirmDialog
        open={folderDeleteTarget !== null}
        title="폴더 삭제"
        message={`"${folderDeleteTarget?.name}" 폴더를 삭제할까요? 안의 문서는 미분류로 이동합니다.`}
        onConfirm={confirmDeleteFolder}
        onCancel={() => setFolderDeleteTarget(null)}
        busy={folderDeleteBusy}
      />

      <DocumentInfoDialog document={infoTarget} onClose={() => setInfoTarget(null)} />

      <MoveDocumentDialog
        document={moveTarget}
        currentProjectId={Number(projectId)}
        onCancel={() => setMoveTarget(null)}
        onMoved={handleDocumentMoved}
      />

      <ProjectMembersDialog
        project={membersOpen ? project : null}
        isOwner={isOwner}
        onClose={() => setMembersOpen(false)}
        onVisibilityChanged={setProject}
      />
    </div>
  );
}

function ProjectDocumentsSkeleton() {
  return (
    <div className="mx-auto flex h-full max-w-6xl animate-pulse flex-col gap-6 pb-6" aria-busy>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-16 rounded bg-surface" />
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="h-7 w-56 rounded bg-surface-2" />
            <div className="mt-2 h-4 w-24 rounded bg-surface" />
          </div>
          <div className="h-9 w-24 rounded-control bg-surface-2" />
        </div>
      </div>
      <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-panel border border-border bg-surface">
        <div className="h-11 shrink-0 border-b border-border" />
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="h-40 shrink-0 border-b border-border lg:h-auto lg:w-56 lg:border-b-0 lg:border-r" />
          <div className="min-h-0 flex-1" />
        </div>
      </div>
    </div>
  );
}
