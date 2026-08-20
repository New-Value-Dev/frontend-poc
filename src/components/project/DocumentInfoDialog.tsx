"use client";

import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/primitives";
import { FileTypeIcon } from "@/components/ui/icons/FileTypeIcon";
import { formatFileSize } from "@/lib/format";
import type { Document } from "@/lib/types";

function authorLabel(d: Document) {
  return d.author?.name || d.author?.email || d.created_by || "-";
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

export function DocumentInfoDialog({
  document,
  onClose,
}: {
  document: Document | null;
  onClose: () => void;
}) {
  return (
    <Modal open={document !== null} onClose={onClose} title="문서 정보" className="max-w-sm">
      {document && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <FileTypeIcon fileName={document.current_version?.original_file_name} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{document.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {document.current_version?.original_file_name ?? "-"}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-ink-muted">상태</dt>
            <dd>
              <StatusBadge status={document.current_version?.processing_status ?? "UPLOADED"} />
            </dd>
            <dt className="text-ink-muted">버전</dt>
            <dd className="text-ink">
              {document.current_version ? `V${document.current_version.version_no}` : "-"}
            </dd>
            <dt className="text-ink-muted">크기</dt>
            <dd className="text-ink">{formatFileSize(document.current_version?.file_size)}</dd>
            <dt className="text-ink-muted">작성자</dt>
            <dd className="text-ink">{authorLabel(document)}</dd>
            <dt className="text-ink-muted">생성일</dt>
            <dd className="text-ink">{fmtDateTime(document.created_at)}</dd>
            {document.description && (
              <>
                <dt className="text-ink-muted">설명</dt>
                <dd className="text-ink">{document.description}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </Modal>
  );
}
