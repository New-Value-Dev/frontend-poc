"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  ErrorBanner,
  FOCUS_RING,
  PageHeader,
  ProofreadCategoryBadge,
} from "@/components/ui/primitives";
import { TextEditor, type TextEditorHandle } from "@/components/proofread/TextEditor";
import { SaveAsDocumentDialog } from "@/components/proofread/SaveAsDocumentDialog";
import { startTextProofread, getTextProofreadJob, listTextProofreadJobs } from "@/lib/ai";
import { errorMessage } from "@/lib/api";
import type { Document, FindingStatus, TextProofreadFinding } from "@/lib/types";

type Finding = TextProofreadFinding & { status: FindingStatus };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 90;

const DRAFT_KEY = "proofread:draft-markdown";
const DISMISSED_JOB_KEY = "proofread:dismissed-job-id";

function loadDraft(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(markdown: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_KEY, markdown);
  } catch {
    // no-op
  }
}

function loadDismissedJobId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DISMISSED_JOB_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function saveDismissedJobId(id: number | null) {
  if (typeof window === "undefined") return;
  try {
    if (id == null) localStorage.removeItem(DISMISSED_JOB_KEY);
    else localStorage.setItem(DISMISSED_JOB_KEY, String(id));
  } catch {
    // no-op
  }
}

export default function ProofreadTextPage() {
  const editorRef = useRef<TextEditorHandle>(null);
  const [draftMarkdown] = useState(loadDraft);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveMarkdown, setSaveMarkdown] = useState("");
  const [saveOriginalMarkdown, setSaveOriginalMarkdown] = useState("");
  const [saved, setSaved] = useState<Document | null>(null);
  // 진행 중인 폴링 루프를 취소하기 위한 토큰. AiPanel의 오탈자 검증 폴링과 같은 패턴.
  const pollRef = useRef<{ cancelled: boolean } | null>(null);
  // 마운트 시 이어받았거나 방금 시작한 job의 id. 초기화 시 이 id를 "무시할 job"으로 기록한다.
  const currentJobIdRef = useRef<number | null>(null);
  const restoreSuppressedRef = useRef(false);
  // 검사를 걸었던 시점의 마크다운 — "새 문서로 저장" 시 V1(원본)으로 남겨 교정 전후를 구분한다.
  const originalMarkdownRef = useRef(draftMarkdown);

  const acceptedCount = findings.filter((f) => f.status === "accepted").length;

  function stopPolling() {
    if (pollRef.current) pollRef.current.cancelled = true;
  }

  async function pollJob(jobId: number, token: { cancelled: boolean }) {
    let done = false;
    for (let i = 0; i < POLL_MAX_ATTEMPTS && !done; i++) {
      await sleep(POLL_INTERVAL_MS);
      if (token.cancelled) return;
      let job;
      try {
        job = await getTextProofreadJob(jobId);
      } catch {
        continue;
      }
      if (token.cancelled) return;
      if (job.status === "COMPLETED") {
        setFindings(job.findings.map((f) => ({ ...f, status: "pending" as FindingStatus })));
        setChecked(true);
        setChecking(false);
        done = true;
      } else if (job.status === "FAILED") {
        setCheckError(job.error || "검사에 실패했습니다.");
        setChecking(false);
        done = true;
      }
    }
    if (!done) {
      setCheckError("검사 시간이 초과되었습니다. 다시 시도해 주세요.");
      setChecking(false);
    }
  }

  // 마운트 시 내 최근 job을 조회해 이어받는다
  useEffect(() => {
    let cancelled = false;
    listTextProofreadJobs()
      .then(async (list) => {
        const latest = [...list].sort(
          (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
        )[0];
        if (!latest || cancelled) return;
        if (latest.id === loadDismissedJobId()) return;
        const full = await getTextProofreadJob(latest.id);
        if (cancelled) return;
        if (restoreSuppressedRef.current) {
          // 응답을 기다리는 사이에 사용자가 이미 초기화를 눌렀다 — 이 job을 이어받는 대신
          // dismiss 기록만 남겨서, 이후 다른 메뉴에 갔다 와도 다시 복원되지 않게 한다.
          saveDismissedJobId(full.id);
          return;
        }
        currentJobIdRef.current = full.id;
        if (full.status === "RUNNING") {
          setChecking(true);
          const token = { cancelled: false };
          pollRef.current = token;
          void pollJob(latest.id, token);
        } else if (full.status === "COMPLETED") {
          setFindings(full.findings.map((f) => ({ ...f, status: "pending" as FindingStatus })));
          setChecked(true);
        } else if (full.status === "FAILED") {
          setCheckError(full.error || "검사에 실패했습니다.");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, []);

  async function handleCheck() {
    const markdown = editorRef.current?.getText() ?? "";
    if (!markdown.trim()) return;
    stopPolling();
    setChecking(true);
    setChecked(false);
    setCheckError(null);
    setSaved(null);
    const currentMarkdown = editorRef.current?.getMarkdown() ?? "";
    saveDraft(currentMarkdown);
    originalMarkdownRef.current = currentMarkdown;
    restoreSuppressedRef.current = false;
    try {
      const started = await startTextProofread(markdown);
      currentJobIdRef.current = started.id;
      saveDismissedJobId(null);
      const token = { cancelled: false };
      pollRef.current = token;
      await pollJob(started.id, token);
    } catch (e) {
      setCheckError(errorMessage(e, "검사에 실패했습니다."));
      setChecking(false);
    }
  }

  function setFindingStatus(id: string, status: FindingStatus) {
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
  }

  function setAllFindings(status: FindingStatus) {
    setFindings((prev) => prev.map((f) => ({ ...f, status })));
  }

  function applyAccepted() {
    const current = editorRef.current;
    if (!current) return;
    let next = current.getMarkdown();
    for (const f of findings) {
      if (f.status === "accepted") next = next.split(f.original).join(f.suggestion);
    }
    current.setMarkdown(next);
    saveDraft(next);
  }

  function openSaveDialog() {
    setSaveMarkdown(editorRef.current?.getMarkdown() ?? "");
    setSaveOriginalMarkdown(originalMarkdownRef.current);
    setSaveOpen(true);
  }

  function resetAll() {
    stopPolling();
    editorRef.current?.setMarkdown("");
    saveDraft("");
    originalMarkdownRef.current = "";
    restoreSuppressedRef.current = true;
    if (currentJobIdRef.current != null) {
      saveDismissedJobId(currentJobIdRef.current);
      currentJobIdRef.current = null;
    }
    setChecking(false);
    setChecked(false);
    setFindings([]);
    setCheckError(null);
    setSaved(null);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        title="맞춤법 검사기"
        description="텍스트를 바로 입력해 맞춤법과 띄어쓰기를 검사하고, 승인한 교정을 반영해 새 문서로 저장할 수 있어요."
      />

      <Card>
        <CardHeader>
          <CardTitle>텍스트 입력</CardTitle>
          <button
            type="button"
            onClick={resetAll}
            className={`rounded-sm text-xs text-ink-muted hover:text-ink ${FOCUS_RING}`}
          >
            초기화
          </button>
        </CardHeader>
        <div className="p-4">
          <TextEditor
            ref={editorRef}
            initialValue={draftMarkdown}
            placeholder="검사할 텍스트를 입력하거나 붙여넣으세요."
            height="360px"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">
              {checking
                ? "검사가 진행 중이에요. 다른 페이지로 이동해도 계속 진행되고, 끝나면 알림으로 알려드려요."
                : "텍스트를 입력하거나 붙여넣은 뒤 검사를 눌러주세요."}
            </p>
            <Button onClick={handleCheck} disabled={checking}>
              {checking ? "검사 중…" : "맞춤법 검사"}
            </Button>
          </div>
          {checkError && (
            <div className="mt-3">
              <ErrorBanner message={checkError} />
            </div>
          )}
        </div>
      </Card>

      {checked && (
        <Card>
          <CardHeader>
            <CardTitle>검사 결과</CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-muted">{findings.length}건 발견</span>
              {findings.length > 0 && (
                <>
                  <button
                    type="button"
                    disabled={findings.every((f) => f.status === "accepted")}
                    onClick={() => setAllFindings("accepted")}
                    className={`rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    전체 승인
                  </button>
                  <button
                    type="button"
                    disabled={findings.every((f) => f.status === "pending")}
                    onClick={() => setAllFindings("pending")}
                    className={`rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    전체 선택 해제
                  </button>
                </>
              )}
            </div>
          </CardHeader>
          <div className="flex flex-col gap-3 p-4">
            {findings.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-muted">발견된 문제가 없습니다</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-surface p-3">
              <p className="text-xs text-ink-muted">
                {saved ? (
                  <>
                    <span className="font-medium text-emerald-700">{saved.name}</span>
                    (으)로 저장했어요.
                  </>
                ) : acceptedCount > 0 ? (
                  `승인한 교정 ${acceptedCount}건을 에디터에 적용한 뒤 저장할 수 있어요.`
                ) : (
                  "교정을 승인한 뒤 에디터에 적용하거나, 바로 새 문서로 저장할 수 있어요."
                )}
              </p>
              <div className="flex items-center gap-2">
                {acceptedCount > 0 && (
                  <Button variant="outline" onClick={applyAccepted}>
                    승인한 교정 {acceptedCount}건 적용
                  </Button>
                )}
                <Button onClick={openSaveDialog}>새 문서로 저장</Button>
              </div>
            </div>

            <ul className="flex flex-col gap-2">
              {findings.map((f) => (
                <li
                  key={f.id}
                  className={`rounded-control border p-3 text-sm transition-colors ${
                    f.status === "accepted"
                      ? "border-emerald-200 bg-emerald-50/40"
                      : f.status === "rejected"
                        ? "border-border bg-surface opacity-60"
                        : "border-border"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <ProofreadCategoryBadge category={f.category} />
                  </div>
                  <p>
                    <span className="text-ink-muted line-through">{f.original}</span>
                    <span className="mx-1.5 text-ink-muted">→</span>
                    <span className="font-medium text-ink">{f.suggestion}</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{f.reason}</p>

                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFindingStatus(f.id, f.status === "accepted" ? "pending" : "accepted")
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        f.status === "accepted"
                          ? "bg-emerald-100 text-emerald-700"
                          : "border border-border text-ink-muted hover:bg-surface"
                      } ${FOCUS_RING}`}
                    >
                      {f.status === "accepted" ? "승인됨" : "승인"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFindingStatus(f.id, f.status === "rejected" ? "pending" : "rejected")
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        f.status === "rejected"
                          ? "bg-primary-soft text-primary"
                          : "border border-border text-ink-muted hover:bg-surface"
                      } ${FOCUS_RING}`}
                    >
                      {f.status === "rejected" ? "반려됨" : "반려"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <SaveAsDocumentDialog
        open={saveOpen}
        markdown={saveMarkdown}
        originalMarkdown={saveOriginalMarkdown}
        onCancel={() => setSaveOpen(false)}
        onSaved={(doc) => {
          setSaved(doc);
          setSaveOpen(false);
          saveDraft("");
        }}
      />
    </div>
  );
}
