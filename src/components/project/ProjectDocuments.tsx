"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getProject, listFolders, createFolder, updateFolder, deleteFolder } from "@/lib/projects";
import { listDocuments, uploadDocument, deleteDocument } from "@/lib/documents";
import { getVersionStatus } from "@/lib/versions";
import { errorMessage, isAuthError } from "@/lib/api";
import type { Project, Folder, Document } from "@/lib/types";
import {
  PageHeader,
  Card,
  Button,
  StatusBadge,
  ErrorBanner,
  BackLink,
} from "@/components/ui/primitives";
import { ConfirmDialog, PromptDialog } from "@/components/ui/Modal";
import { UploadDialog, type UploadInput } from "./UploadDialog";
import { FolderTree, descendantIds } from "./FolderTree";
import { useAuth } from "@/components/auth/AuthProvider";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

const EMPTY = "-";

function authorLabel(d: Document) {
  return d.author?.name || d.author?.email || d.created_by || EMPTY;
}

export function ProjectDocuments({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
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
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<Folder | null>(null);
  const [folderDeleteBusy, setFolderDeleteBusy] = useState(false);

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

  const { loading: authLoading } = useAuth();

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

  async function renameFolderTo(name: string) {
    if (!renameTarget) return;
    const id = renameTarget.id;
    setRenameBusy(true);
    try {
      const updated = await updateFolder(String(id), { name });
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: updated.name } : f)));
      setRenameTarget(null);
    } catch (e) {
      setError(errorMessage(e, "폴더 이름 변경에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setRenameBusy(false);
    }
  }

  async function confirmDeleteFolder() {
    if (!folderDeleteTarget) return;
    const id = folderDeleteTarget.id;
    setFolderDeleteBusy(true);
    try {
      await deleteFolder(String(id));
      if (activeFolder === id) setActiveFolder(null);
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

  const shown = useMemo(() => {
    if (activeFolder == null) return documents;
    const ids = descendantIds(activeFolder, folders);
    return documents.filter((d) => d.folder_id != null && ids.has(d.folder_id));
  }, [documents, folders, activeFolder]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/projects">프로젝트</BackLink>
        <PageHeader
          title={project?.name ?? `프로젝트 #${projectId}`}
          description={`문서 ${documents.length}개`}
          /* 전각 `＋` 글리프를 아이콘 대신 쓰던 것을 제거 — 버튼 라벨이 이미 업로드임을 설명한다. */
          actions={<Button onClick={() => setUploadOpen(true)}>문서 업로드</Button>}
        />
      </div>

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        {/* 폴더 트리 */}
        <FolderTree
          folders={folders}
          activeId={activeFolder}
          onSelect={setActiveFolder}
          onNew={() => setFolderDialog(true)}
          onRename={setRenameTarget}
          onDelete={setFolderDeleteTarget}
        />

        {/* 문서 목록 */}
        {loading ? (
          <Card className="grid place-items-center py-16 text-sm text-ink-muted">불러오는 중…</Card>
        ) : shown.length === 0 && !error ? (
          <Card className="grid place-items-center gap-1 py-16 text-center">
            <p className="text-sm font-medium text-ink">문서가 없습니다.</p>
            <p className="text-xs text-ink-muted">＋ 문서 업로드로 시작하세요.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-ink-muted">
                    <th className="px-5 py-3 font-medium">문서명</th>
                    <th className="px-5 py-3 font-medium">유형</th>
                    <th className="px-5 py-3 font-medium">버전</th>
                    <th className="px-5 py-3 font-medium">처리상태</th>
                    <th className="px-5 py-3 font-medium">작성자</th>
                    <th className="px-5 py-3 font-medium">생성일</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((d) => (
                    <tr key={d.id} className="hover:bg-surface">
                      <td className="px-5 py-3">
                        <Link href={`/documents/${d.id}`} className="font-medium text-ink hover:text-primary">
                          {d.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{d.document_type ?? EMPTY}</td>
                      <td className="px-5 py-3 text-ink-muted">
                        {d.current_version ? `V${d.current_version.version_no}` : EMPTY}
                      </td>
                      <td className="px-5 py-3">
                        {/* 버전이 없으면 UPLOADED로 본다 — 백엔드 RecentDocumentRead와 같은 규칙. */}
                        <StatusBadge status={d.current_version?.processing_status ?? "UPLOADED"} />
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{authorLabel(d)}</td>
                      <td className="px-5 py-3 text-ink-muted">{fmtDate(d.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(d)}
                          className="text-xs text-ink-muted hover:text-primary"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

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
        onSubmit={createNewFolder}
        onCancel={() => setFolderDialog(false)}
        busy={folderBusy}
      />

      {renameTarget && (
        <PromptDialog
          open
          title="폴더 이름 변경"
          placeholder="폴더 이름"
          initialValue={renameTarget.name}
          submitLabel="변경"
          onSubmit={renameFolderTo}
          onCancel={() => setRenameTarget(null)}
          busy={renameBusy}
        />
      )}

      <ConfirmDialog
        open={folderDeleteTarget !== null}
        title="폴더 삭제"
        message={`"${folderDeleteTarget?.name}" 폴더를 삭제할까요? 안의 문서는 미분류로 이동합니다.`}
        onConfirm={confirmDeleteFolder}
        onCancel={() => setFolderDeleteTarget(null)}
        busy={folderDeleteBusy}
      />
    </div>
  );
}
