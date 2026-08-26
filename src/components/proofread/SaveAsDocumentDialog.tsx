"use client";

import { useEffect, useState } from "react";
import { listProjects, listFolders } from "@/lib/projects";
import { uploadDocument } from "@/lib/documents";
import { errorMessage } from "@/lib/api";
import type { Document, Folder, Project } from "@/lib/types";
import { flattenFolders } from "@/components/project/FolderTree";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Button, ErrorBanner } from "@/components/ui/primitives";

const ROOT_VALUE = "__root__";

export function SaveAsDocumentDialog({
  open,
  markdown,
  onCancel,
  onSaved,
}: {
  open: boolean;
  markdown: string;
  onCancel: () => void;
  onSaved: (document: Document) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState<string>(ROOT_VALUE);
  const [title, setTitle] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle("");
    setProjectId(null);
    setLoadingProjects(true);
    listProjects()
      .then((list) => {
        setProjects(list);
        setProjectId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch((e) => setError(errorMessage(e, "프로젝트 목록을 불러오지 못했습니다.")))
      .finally(() => setLoadingProjects(false));
  }, [open]);

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
    if (projectId == null || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const blob = new Blob([markdown], { type: "text/markdown" });
      const file = new File([blob], `${title.trim()}.md`, { type: "text/markdown" });
      const res = await uploadDocument(String(projectId), file, {
        folder_id: folderId === ROOT_VALUE ? undefined : Number(folderId),
        name: title.trim(),
      });
      onSaved(res.document);
    } catch (e) {
      setError(errorMessage(e, "문서 저장에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  }

  const flatFolders = flattenFolders(folders);

  return (
    <Modal open={open} onClose={onCancel} title="새 문서로 저장" className="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          지금 에디터에 있는 내용을 새 문서로 등록해요. 저장 위치와 제목을 정해주세요.
        </p>

        <Field label="제목" htmlFor="save-title">
          <Input
            id="save-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문서 제목"
          />
        </Field>

        <Field label="프로젝트" htmlFor="save-project">
          <Select
            id="save-project"
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

        <Field label="폴더" htmlFor="save-folder">
          <Select
            id="save-folder"
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
          <Button
            variant="dark"
            onClick={handleSubmit}
            disabled={busy || projectId == null || !title.trim()}
          >
            {busy ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
