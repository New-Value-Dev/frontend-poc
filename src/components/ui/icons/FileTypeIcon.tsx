export type FileCategory = "pdf" | "word" | "excel" | "ppt" | "hwp" | "image" | "text" | "generic";

const EXT_CATEGORY: Record<string, FileCategory> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
  csv: "excel",
  ppt: "ppt",
  pptx: "ppt",
  hwp: "hwp",
  hwpx: "hwp",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  svg: "image",
  heic: "image",
  txt: "text",
  md: "text",
};

type CategoryStyle = { label: string; fg: string; bg: string };

const CATEGORY_STYLE: Record<FileCategory, CategoryStyle> = {
  pdf: { label: "PDF", fg: "#dc2626", bg: "#fef2f2" },
  word: { label: "DOC", fg: "#2563eb", bg: "#eaf1fe" },
  excel: { label: "XLS", fg: "#16a34a", bg: "#eafbf0" },
  ppt: { label: "PPT", fg: "#d97706", bg: "#fef3e2" },
  hwp: { label: "HWP", fg: "#0d9488", bg: "#e8fbf8" },
  image: { label: "IMG", fg: "#7c3aed", bg: "#f3ecfe" },
  text: { label: "", fg: "#52525b", bg: "#f1f1f3" },
  generic: { label: "", fg: "#6b6b73", bg: "#efeff1" },
};

export function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

export function categoryOfExt(ext: string): FileCategory {
  return EXT_CATEGORY[ext.toLowerCase()] ?? "generic";
}

export function categoryOfFileName(name: string | null | undefined): FileCategory {
  if (!name) return "generic";
  return categoryOfExt(extOf(name));
}

/** 문서 정보 다이얼로그 등에서 라벨/색을 함께 재사용할 수 있게 메타로 노출. */
export function fileTypeMeta(fileName: string | null | undefined) {
  const ext = fileName ? extOf(fileName) : "";
  const category = categoryOfExt(ext);
  const style = CATEGORY_STYLE[category];
  const label = style.label || ext.toUpperCase().slice(0, 4);
  return { category, ext, label, fg: style.fg, bg: style.bg };
}

export function FileTypeIcon({
  fileName,
  size = 40,
  className = "",
}: {
  fileName?: string | null;
  size?: number;
  className?: string;
}) {
  const { label, fg, bg } = fileTypeMeta(fileName);
  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="0 0 34 40"
      className={className}
      aria-hidden
    >
      {/* 페이지 실루엣 (모서리 접힘) — 모든 유형 공통, 폴더와 확실히 다른 모양 */}
      <path
        d="M4 2h16l8 8v26a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
        fill="#ffffff"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
      <path d="M20 2v6a2 2 0 0 0 2 2h8" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* 유형 배지 — 모양(공통 페이지 실루엣) 안에서 색 + 라벨 텍스트로 유형을 구분 */}
      <rect x="2" y="24" width="30" height="14" rx="3" fill={bg} />
      <text
        x="17"
        y="34"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill={fg}
      >
        {label}
      </text>
    </svg>
  );
}

/** 폴더 타일 아이콘. 색상 축은 파일 유형 전용으로 남기기 위해 의도적으로 중립색만 사용. */
export function FolderTileIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill="var(--color-surface-2)"
        stroke="var(--color-ink-muted)"
        strokeWidth="1.6"
      />
    </svg>
  );
}
