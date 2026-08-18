"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Textarea, Select } from "@/components/ui/primitives";
import { flattenFolders } from "./FolderTree";
import type { Folder } from "@/lib/types";

const MAX_MB = 50;
const ALLOWED = ["pdf", "hwpx", "hwp", "docx", "xlsx", "pptx", "txt", "md"];
const ACCEPT = ALLOWED.map((e) => `.${e}`).join(",");

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
function stripExt(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type UploadInput = {
  file: File;
  name: string;
  folderId: number | null;
  description?: string;
};

export function UploadDialog({
  open,
  folders,
  defaultFolderId,
  busy = false,
  onCancel,
  onUpload,
}: {
  open: boolean;
  folders: Folder[];
  defaultFolderId: number | null;
  busy?: boolean;
  onCancel: () => void;
  onUpload: (input: UploadInput) => void;
}) {
  // 열릴 때마다 새로 마운트되므로(부모가 조건부 렌더링) 초기 상태만으로 충분하고
  // 별도의 리셋 effect는 필요 없다.
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<number | null>(defaultFolderId);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // object URL이 바뀌거나 언마운트될 때 해제.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(f: File) {
    const ext = extOf(f.name);
    if (!ALLOWED.includes(ext)) {
      setLocalError(`지원하지 않는 형식입니다. (${ALLOWED.join(", ")})`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setLocalError(`파일이 너무 큽니다. (최대 ${MAX_MB}MB)`);
      return;
    }
    setLocalError(null);
    setFile(f);
    setName((prev) => prev || stripExt(f.name));

    // 미리보기
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return f.type.startsWith("image/") || ext === "pdf" ? URL.createObjectURL(f) : null;
    });
    setTextPreview(null);
    if (ext === "txt" || ext === "md") {
      f.slice(0, 4000)
        .text()
        .then((t) => setTextPreview(t))
        .catch(() => setTextPreview(null));
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  function submit() {
    if (!file || !name.trim()) return;
    onUpload({
      file,
      name: name.trim(),
      folderId,
      description: description.trim() || undefined,
    });
  }

  const ext = file ? extOf(file.name) : "";
  const flat = flattenFolders(folders);

  return (
    <Modal open={open} onClose={onCancel} title="문서 업로드">
      <div className="flex flex-col gap-4">
        {/* 파일 선택 / 미리보기 */}
        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragOver ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2"
            }`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink-muted">
              <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <span className="text-sm font-medium text-ink">클릭 또는 드래그해서 파일 선택</span>
            <span className="text-xs text-ink-muted">{ALLOWED.join(", ")} · 최대 {MAX_MB}MB</span>
          </button>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-[10px] font-bold uppercase text-primary">
                  {ext}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                  <p className="text-xs text-ink-muted">{fmtSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="shrink-0 text-xs text-primary hover:underline"
              >
                다른 파일
              </button>
            </div>

            {/* 미리보기 본문 */}
            {previewUrl && file.type.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="미리보기" className="mt-3 max-h-48 w-full rounded-lg object-contain" />
            )}
            {previewUrl && ext === "pdf" && (
              <iframe src={previewUrl} title="PDF 미리보기" className="mt-3 h-48 w-full rounded-lg border border-border" />
            )}
            {textPreview != null && (
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-border bg-canvas p-2 text-xs text-ink-muted whitespace-pre-wrap">
                {textPreview}
                {textPreview.length >= 4000 ? "…" : ""}
              </pre>
            )}
            {!previewUrl && textPreview == null && (
              <p className="mt-3 text-xs text-ink-muted">이 형식은 미리보기를 지원하지 않습니다.</p>
            )}
          </div>
        )}

        <input ref={inputRef} type="file" accept={ACCEPT} onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) pickFile(f);
        }} className="hidden" />

        <Field label="제목" htmlFor="upload-title">
          <Input
            id="upload-title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="문서 제목"
          />
        </Field>

        <Field label="폴더" htmlFor="upload-folder">
          <Select
            id="upload-folder"
            value={folderId ?? ""}
            onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">최상위 (폴더 없음)</option>
            {flat.map((f) => (
              <option key={f.id} value={f.id}>
                {`${"  ".repeat(f.depth)}${f.name}`}
              </option>
            ))}
          </Select>
        </Field>

        {/* `description`은 `documents` 테이블의 실제 컬럼이며 업로드 시 함께 저장된다. */}
        <Field label="설명" htmlFor="upload-description" hint="선택 항목입니다.">
          <Textarea
            id="upload-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="문서에 대한 간단한 설명"
            className="resize-none"
          />
        </Field>

        {localError && (
          <p role="alert" className="text-sm text-primary">
            {localError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button onClick={submit} disabled={!file || !name.trim() || busy}>
            {busy ? "업로드 중…" : "업로드"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
