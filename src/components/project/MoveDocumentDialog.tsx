"use client";

import { useEffect, useState } from "react";
import { listProjects, listFolders } from "@/lib/projects";
import { moveDocument } from "@/lib/documents";
import { errorMessage } from "@/lib/api";
import type { Document, Folder, Project } from "@/lib/types";
import { flattenFolders } from "./FolderTree";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Button, ErrorBanner } from "@/components/ui/primitives";

const ROOT_VALUE = "__root__";

export function MoveDocumentDialog({
  document: doc,
  currentProjectId,
  onCancel,
  onMoved,
}: {
  document: Document | null;
  currentProjectId: number;
  onCancel: () => void;
  onMoved: (moved: Document, targetProjectId: number) => void;
}) {
  const open = doc !== null;
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState<string>(ROOT_VALUE);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setProjectId(currentProjectId);
    setLoadingProjects(true);
    listProjects()
      .then(setProjects)
      .catch((e) => setError(errorMessage(e, "프로젝트 목록을 불러오지 못했습니다.")))
      .finally(() => setLoadingProjects(false));
  }, [open, doc?.id]);

  useEffect(() => {
    if (!open || projectId == null) return;
    setFolderId(ROOT_VALUE);
    setLoadingFolders(true);
    listFolders(String(projectId))
      .then(setFolders)
      .catch((e) => setError(errorMessage(e, "폴더 목록을 불러오지 못했습니다.")))
      .finally(() => setLoadingFolders(false));
  }, [open, projectId]);

  async function handleSubmit() {
    if (!doc || projectId == null) return;
    setBusy(true);
    setError(null);
    try {
      const target = folderId === ROOT_VALUE ? null : Number(folderId);
      const moved = await moveDocument(String(doc.id), {
        project_id: projectId === currentProjectId ? undefined : projectId,
        folder_id: target,
      });
      onMoved(moved, projectId);
    } catch (e) {
      setError(errorMessage(e, "문서 이동에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  }

  const flatFolders = flattenFolders(folders);

  return (
    <Modal open={open} onClose={onCancel} title="문서 이동" className="max-w-sm">
      {doc && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">{doc.name}</span> 을(를) 옮길 위치를 선택하세요.
          </p>

          <Field label="프로젝트" htmlFor="move-project">
            <Select
              id="move-project"
              value={projectId ?? ""}
              disabled={loadingProjects}
              onChange={(e) => setProjectId(Number(e.target.value))}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="폴더" htmlFor="move-folder">
            <Select
              id="move-folder"
              value={folderId}
              disabled={loadingFolders}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value={ROOT_VALUE}>최상위(폴더 없음)</option>
              {flatFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {"　".repeat(f.depth)}
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>

          {error && <ErrorBanner message={error} />}

          <div className="mt-1 flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              취소
            </Button>
            <Button variant="dark" onClick={handleSubmit} disabled={busy || projectId == null}>
              {busy ? "이동 중…" : "이동"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
