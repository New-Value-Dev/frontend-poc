"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { getDocument, downloadDocument, fetchDocumentBlob } from "@/lib/documents";
import { getProject } from "@/lib/projects";
import { listVersions, getSections } from "@/lib/versions";
import { errorMessage, isAuthError } from "@/lib/api";
import type { Document, DocumentVersion, Project, Section } from "@/lib/types";
import {
  StatusBadge,
  ErrorBanner,
  Button,
  Tag,
  BackLink,
  FOCUS_RING,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { AiPanel } from "./AiPanel";
import { useAuth } from "@/components/auth/AuthProvider";

const POLL_STOP = ["READY", "FAILED", "CHUNKED"];
const EMPTY = "-";
const HL_ID = "proofread-highlight";

type PreviewKind = "pdf" | "image" | "text";

/** 브라우저가 직접 렌더링할 수 있는 형식만 미리보기 대상으로 삼는다 (docx/hwpx 등은 제외). */
function previewKindOf(version: DocumentVersion | null): PreviewKind | null {
  if (!version) return null;
  const mime = version.mime_type ?? "";
  const ext = version.original_file_name.split(".").pop()?.toLowerCase() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/") || ext === "txt" || ext === "md") return "text";
  return null;
}

function markFirst(body: string, text: string | null) {
  if (!text) return body;
  const at = body.indexOf(text);
  if (at < 0) return body;
  return (
    <>
      {body.slice(0, at)}
      <mark
        id={HL_ID}
        className="rounded bg-primary/15 px-0.5 text-ink ring-1 ring-primary/40"
      >
        {text}
      </mark>
      {body.slice(at + text.length)}
    </>
  );
}

function fmtSize(bytes?: number | null) {
  if (bytes == null) return EMPTY;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString("ko-KR") : EMPTY;
}

export function DocumentDetail({ docId }: { docId: string }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [highlight, setHighlight] = useState<{ sectionId: number; text: string | null } | null>(
    null,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) {
      setLoading(true);
      setError(null);
      setNeedLogin(false);
    }
    try {
      const d = await getDocument(docId);
      setDoc(d);
      const [vs, proj] = await Promise.all([
        listVersions(docId).catch(() => [] as DocumentVersion[]),
        getProject(String(d.project_id)).catch(() => null),
      ]);
      setVersions(vs);
      setProject(proj);
      const cv =
        d.current_version ?? vs.find((v) => v.id === d.current_version_id) ?? vs[0] ?? null;
      setSections(cv ? await getSections(cv.id).catch(() => [] as Section[]) : []);
    } catch (e) {
      setError(errorMessage(e, "문서를 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, authLoading]);

  const version =
    doc?.current_version ??
    versions.find((v) => v.id === doc?.current_version_id) ??
    versions[0] ??
    null;
  const status = version?.processing_status ?? "";

  // 문서가 아직 처리 중이면 자동으로 새로고침한다.
  useEffect(() => {
    if (!status || POLL_STOP.includes(status)) return;
    const t = setInterval(() => load(true), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const ordered = useMemo(
    () => [...sections].sort((a, b) => a.order_no - b.order_no),
    [sections],
  );
  function depthOf(s: Section) {
    let depth = 0;
    let cur: Section | undefined = s;
    while (cur && cur.parent_section_id != null && depth < 6) {
      cur = byId.get(cur.parent_section_id);
      depth += 1;
    }
    return depth;
  }
  const titleOf = (s: Section) => s.title?.trim() ?? "";
  const hasTitle = (s: Section) => titleOf(s).length > 0;
  // 아웃라인에는 모든 단락이 아니라 제목이 있는 실제 헤딩만 나열한다.
  const outline = useMemo(
    () => ordered.filter((s) => (s.title?.trim() ?? "").length > 0),
    [ordered],
  );

  function focusSection(sectionId: number, original?: string) {
    setHighlight({ sectionId, text: original?.trim() || null });
  }

  useEffect(() => {
    if (!highlight) return;
    const el =
      document.getElementById(HL_ID) ?? document.getElementById(`sec-${highlight.sectionId}`);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    const t = window.setTimeout(() => setHighlight(null), 2600);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const searchParams = useSearchParams();
  const urlSectionId = Number(searchParams.get("section"));
  const appliedUrlFocusRef = useRef(false);
  useEffect(() => {
    if (appliedUrlFocusRef.current) return;
    if (!Number.isFinite(urlSectionId) || !byId.has(urlSectionId)) return;
    appliedUrlFocusRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    focusSection(urlSectionId);
  }, [urlSectionId, byId]);

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadDocument(docId, version?.original_file_name);
    } catch (e) {
      setError(errorMessage(e, "다운로드에 실패했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setDownloading(false);
    }
  }

  const previewKind = previewKindOf(version);

  // object URL이 바뀌거나 언마운트될 때 해제.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function openPreview() {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const blob = await fetchDocumentBlob(docId);
      if (previewKind === "text") {
        setPreviewText(await blob.text());
      } else {
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (e) {
      setPreviewError(errorMessage(e, "미리보기를 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewError(null);
  }

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-7xl">
        <BackLink href="/projects">프로젝트</BackLink>
        <div className="mt-4">
          <ErrorBanner message={error ?? "문서를 찾을 수 없습니다."} needLogin={needLogin} />
        </div>
      </div>
    );
  }

  // 메타데이터/개요는 데스크톱 사이드 패널과 모바일 접이식 패널이 그대로 공유한다.
  const metaBody = (
    <>
      <PaneLabel>메타데이터</PaneLabel>
      <dl className="flex flex-col gap-2 text-xs">
        <MetaRow k="유형" v={doc.document_type ?? EMPTY} />
        <MetaRow k="버전" v={version ? `V${version.version_no}` : EMPTY} />
        <MetaRow k="파일" v={version?.original_file_name ?? EMPTY} />
        <MetaRow k="크기" v={fmtSize(version?.file_size)} />
        <MetaRow k="섹션" v={`${sections.length}개`} />
        <MetaRow k="버전 수" v={`${versions.length}개`} />
        <MetaRow
          k="작성자"
          v={doc.author?.name || doc.author?.email || doc.created_by || EMPTY}
        />
        <MetaRow k="업로드" v={fmtDate(doc.created_at)} />
      </dl>
      {doc.description && (
        <div className="mt-3 border-t border-border pt-3">
          <PaneLabel className="mb-1">설명</PaneLabel>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {doc.description}
          </p>
        </div>
      )}
    </>
  );

  function outlinePane(scrollable: boolean) {
    if (outline.length === 0) {
      return (
        <p className="text-xs text-ink-muted">
          {ordered.length === 0 ? "아직 섹션이 없습니다." : "제목이 있는 섹션이 없습니다."}
        </p>
      );
    }
    return (
      <ul className={scrollable ? "min-h-0 flex-1 overflow-y-auto" : undefined}>
        {outline.map((s) => (
          <li key={s.id}>
            <a
              href={`#sec-${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                focusSection(s.id);
              }}
              style={{ paddingLeft: 8 + depthOf(s) * 12 }}
              title={titleOf(s)}
              className={`block truncate rounded-control py-1.5 pr-2 text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink ${FOCUS_RING} focus-visible:ring-offset-0`}
            >
              {titleOf(s)}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 xl:h-full">
      {/* 헤더 */}
      <div className="flex flex-col gap-3">
        <BackLink href={`/projects/${doc.project_id}`}>
          {project?.name ?? `프로젝트 #${doc.project_id}`}
        </BackLink>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* `tracking-tight` 미사용: 문서명은 대부분 한글이라 자간을 좁히면 밀도보다 가독성 손실이 크다. */}
          <h1 className="text-xl font-semibold text-ink">{doc.name}</h1>
          {version && <Tag>V{version.version_no}</Tag>}
          {doc.document_type && <Tag>{doc.document_type}</Tag>}
          <StatusBadge status={status} />
          <span className="font-mono text-xs text-ink-muted">#{doc.id}</span>
          <div className="ml-auto flex gap-2">
            {previewKind && (
              <Button variant="outline" onClick={openPreview} disabled={previewLoading}>
                {previewLoading ? "불러오는 중…" : "원본 보기"}
              </Button>
            )}
            <Button variant="outline" onClick={onDownload} disabled={downloading}>
              {downloading ? "다운로드 중…" : "다운로드"}
            </Button>
          </div>
        </div>
        {doc.description && (
          <p className="text-sm leading-relaxed text-ink-muted">{doc.description}</p>
        )}
      </div>

      {error && <ErrorBanner message={error} needLogin={needLogin} />}

      {/* xl 미만에서는 메타데이터/개요가 사라지지 않도록 접이식 패널로 노출한다 (뷰어 위, 페이지 스크롤에 포함). */}
      <details className="group rounded-panel border border-border bg-canvas xl:hidden">
        <summary
          className={`flex cursor-pointer list-none items-center justify-between rounded-panel px-4 py-3 text-sm font-medium text-ink ${FOCUS_RING}`}
        >
          메타데이터 · 문서 개요
          <span aria-hidden className="text-ink-muted transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="border-t border-border p-4">
          {metaBody}
          <div className="mt-4 border-t border-border pt-4">
            <PaneLabel className="mb-2">문서 개요</PaneLabel>
            {outlinePane(false)}
          </div>
        </div>
      </details>

      {/* 3분할: 아웃라인 · 뷰어 · AI 패널 — xl 미만에서는 각자 스크롤 대신 페이지 전체가 스크롤된다 */}
      <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[200px_1fr_380px]">
        {/* 상단은 메타데이터(항상 표시) · 아래는 스크롤되는 아웃라인 — xl 이상 전용, 그 아래는 위 접이식 패널로 대체 */}
        <div className="hidden min-h-0 flex-col gap-4 xl:flex">
          <div className="shrink-0 rounded-panel border border-border bg-canvas p-4">{metaBody}</div>

          <div className="flex min-h-0 flex-1 flex-col rounded-panel border border-border bg-canvas p-4">
            <PaneLabel className="mb-2 shrink-0">문서 개요</PaneLabel>
            {outlinePane(true)}
          </div>
        </div>

        {/* 뷰어 — xl 미만에서는 페이지 전체가 무한정 길어지지 않도록 자체 높이 상한 + 스크롤을 둔다 */}
        <div className="max-h-[65vh] overflow-y-auto rounded-panel border border-border bg-canvas p-4 sm:p-8 xl:max-h-none xl:min-h-0">
          {ordered.length === 0 ? (
            <div className="grid h-full place-items-center py-16 text-center">
              <div>
                <StatusBadge status={status} />
                <p className="mt-3 text-sm text-ink-muted">
                  {status === "FAILED"
                    ? "문서 처리에 실패했습니다."
                    : POLL_STOP.includes(status)
                      ? "표시할 섹션이 없습니다."
                      : "문서를 분석하고 있습니다…"}
                </p>
              </div>
            </div>
          ) : (
            <article className="mx-auto flex max-w-2xl flex-col gap-5 text-base leading-7 text-ink">
              {ordered.map((s) => {
                const target = highlight?.sectionId === s.id ? highlight.text : null;
                const inTitle = target != null && titleOf(s).includes(target);
                const inContent = target != null && !inTitle && !!s.content?.includes(target);
                const ringed = highlight?.sectionId === s.id && !inTitle && !inContent;
                return (
                <section
                  key={s.id}
                  id={`sec-${s.id}`}
                  className={`scroll-mt-4 rounded-control transition-colors ${
                    ringed ? "bg-primary-soft ring-2 ring-primary/40" : ""
                  }`}
                >
                  {hasTitle(s) &&
                    (s.content ? (
                      <h2
                        className="mb-1 font-semibold text-ink"
                        style={{ paddingLeft: depthOf(s) * 12 }}
                      >
                        {markFirst(titleOf(s), inTitle ? target : null)}
                      </h2>
                    ) : (
                      <p
                        className="whitespace-pre-wrap text-ink"
                        style={{ paddingLeft: depthOf(s) * 12 }}
                      >
                        {markFirst(titleOf(s), inTitle ? target : null)}
                      </p>
                    ))}
                  {s.content && (
                    <p className="whitespace-pre-wrap text-ink">
                      {markFirst(s.content, inContent ? target : null)}
                    </p>
                  )}
                </section>
                );
              })}
            </article>
          )}
        </div>

        {/* AI 패널 — 오타 검증만 연동됨, 나머지 모듈은 placeholder. xl 미만에서도 자체 스크롤이 되도록 높이를 고정한다 */}
        <div className="h-[65vh] overflow-hidden rounded-panel border border-border bg-canvas xl:h-auto xl:min-h-0">
          <AiPanel
            docId={docId}
            status={status}
            fileExt={version?.original_file_name.split(".").pop()?.toLowerCase() ?? null}
            onFocusSection={focusSection}
            onApplied={() => load(true)}
          />
        </div>
      </div>

      <Modal open={previewOpen} onClose={closePreview} title="원본 보기" className="max-w-3xl">
        {previewError ? (
          <ErrorBanner message={previewError} needLogin={needLogin} />
        ) : previewLoading ? (
          <p className="py-10 text-center text-sm text-ink-muted">불러오는 중…</p>
        ) : previewKind === "pdf" && previewUrl ? (
          <iframe
            src={previewUrl}
            title={doc.name}
            className="h-[70vh] w-full rounded-lg border border-border"
          />
        ) : previewKind === "image" && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={doc.name}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        ) : previewKind === "text" && previewText != null ? (
          <pre className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-ink whitespace-pre-wrap">
            {previewText}
          </pre>
        ) : null}
      </Modal>
    </div>
  );
}

function PaneLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-2 text-xs font-semibold text-ink-muted ${className}`}>{children}</p>;
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0 text-ink-muted">{k}</dt>
      <dd className="truncate text-right font-medium text-ink" title={v}>
        {v}
      </dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto flex h-full max-w-7xl animate-pulse flex-col gap-4" aria-busy>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-20 rounded bg-surface" />
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-72 rounded bg-surface-2" />
          <div className="h-5 w-10 rounded-full bg-surface" />
          <div className="h-5 w-16 rounded-full bg-surface" />
          <div className="ml-auto h-9 w-24 rounded-control bg-surface-2" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[200px_1fr_380px]">
        <div className="hidden min-h-0 flex-col gap-4 xl:flex">
          <div className="h-[248px] shrink-0 rounded-panel border border-border bg-surface" />
          <div className="min-h-0 flex-1 rounded-panel border border-border bg-surface" />
        </div>
        <div className="min-h-0 rounded-panel border border-border bg-surface" />
        <div className="min-h-0 rounded-panel border border-border bg-surface" />
      </div>
    </div>
  );
}
