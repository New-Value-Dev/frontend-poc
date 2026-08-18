"use client";

import { useEffect, useRef, useState } from "react";
import { proofread, listAnalyses, getAnalysis, setFindingStatus, applyAnalysis } from "@/lib/ai";
import { ApiError, errorMessage } from "@/lib/api";
import type { ApplyAnalysisResult, FindingStatus, ProofreadResult } from "@/lib/types";
import { Button, FOCUS_RING } from "@/components/ui/primitives";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* AI 모듈 탭 — 지금은 오타 검증만 백엔드에 연동됨. */
const tabs = [
  { key: "proofread", label: "오타 검증" },
  { key: "validation", label: "규정 검증" },
  { key: "compare", label: "문서 비교" },
  { key: "related", label: "관련 문서" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const CATEGORY: Record<string, { label: string; className: string }> = {
  spelling: { label: "맞춤법", className: "bg-violet-50 text-violet-700" },
  spacing: { label: "띄어쓰기", className: "bg-sky-50 text-sky-700" },
  grammar: { label: "문법", className: "bg-emerald-50 text-emerald-700" },
  expression: { label: "표현", className: "bg-surface-2 text-ink-muted" },
};
function cat(c: string) {
  return CATEGORY[c] ?? { label: c, className: "bg-surface-2 text-ink-muted" };
}

/** 아직 파싱이 끝나지 않은 상태 — 이때 오타 검증을 실행하면 409가 난다. */
const NOT_READY = ["UPLOADED", "PARSING"];

export function AiPanel({
  docId,
  status,
  fileExt,
  onFocusSection,
  onApplied,
}: {
  docId: string;
  status: string;
  /** 원본 파일 확장자 — apply 시 PDF 안내 문구를 보여줄지 판단하는 데만 쓰인다. */
  fileExt?: string | null;
  onFocusSection?: (sectionId: number, original?: string) => void;
  /** 승인된 교정이 새 버전으로 적용된 뒤 호출 — 상위에서 문서를 다시 불러오는 데 쓴다. */
  onApplied?: (newVersionId: number) => void;
}) {
  const [active, setActive] = useState<TabKey>("proofread");

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            aria-current={active === t.key ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-t-control px-3 py-2 text-sm transition-colors ${FOCUS_RING} focus-visible:ring-offset-0 ${
              active === t.key
                ? "border-b-2 border-primary font-medium text-primary"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {active === "proofread" && (
          <ProofreadPanel
            docId={docId}
            status={status}
            fileExt={fileExt}
            onFocusSection={onFocusSection}
            onApplied={onApplied}
          />
        )}
        {active === "validation" && <Placeholder title="규정 검증" desc="관련 RULE 문서를 검색해 GPT로 위반·주의 사항을 검증합니다. (준비 중)" />}
        {active === "compare" && <Placeholder title="문서 비교" desc="다른 버전과 섹션을 매칭해 변경 사항을 요약합니다. (준비 중)" />}
        {active === "related" && <Placeholder title="관련 문서" desc="문서 임베딩 기반 유사도로 연관 문서를 추천합니다. (준비 중)" />}
      </div>
    </div>
  );
}

function ProofreadPanel({
  docId,
  status,
  fileExt,
  onFocusSection,
  onApplied,
}: {
  docId: string;
  status: string;
  fileExt?: string | null;
  onFocusSection?: (sectionId: number, original?: string) => void;
  onApplied?: (newVersionId: number) => void;
}) {
  const [result, setResult] = useState<ProofreadResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyAnalysisResult | null>(null);
  const [appliedAnalysisId, setAppliedAnalysisId] = useState<number | null>(null);
  const ready = !NOT_READY.includes(status);
  // 진행 중인 폴링 루프를 취소하기 위한 토큰.
  const pollRef = useRef<{ cancelled: boolean } | null>(null);

  function stopPolling() {
    if (pollRef.current) pollRef.current.cancelled = true;
  }

  /** 분석이 COMPLETED/FAILED가 될 때까지 폴링 (오타 검증은 비동기 실행, 202 → RUNNING). */
  async function poll(analysisId: number) {
    stopPolling();
    const token = { cancelled: false };
    pollRef.current = token;
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      if (token.cancelled) return;
      let full: ProofreadResult;
      try {
        full = await getAnalysis(docId, analysisId);
      } catch {
        continue;
      }
      if (token.cancelled) return;
      setResult(full);
      if (full.status === "COMPLETED" || full.status === "FAILED") {
        setRunning(false);
        if (full.status === "FAILED") setError(full.error || "오타 검증에 실패했습니다.");
        return;
      }
    }
    setRunning(false); // 시간 초과
  }

  // 가장 최근 분석을 불러오고, 아직 실행 중이면 폴링을 재개한다.
  useEffect(() => {
    let cancelled = false;
    listAnalyses(docId, "proofread")
      .then(async (list) => {
        const latest = list.sort(
          (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
        )[0];
        if (!latest || cancelled) return;
        const full = await getAnalysis(docId, latest.id);
        if (cancelled) return;
        setResult(full);
        if (full.status === "RUNNING") {
          setRunning(true);
          void poll(full.id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const started = await proofread(docId); // 202 → RUNNING 레코드
      setResult(started);
      if (started.status === "COMPLETED" || started.status === "FAILED") {
        setRunning(false);
        if (started.status === "FAILED") setError(started.error || "오타 검증에 실패했습니다.");
      } else {
        void poll(started.id);
      }
    } catch (e) {
      setRunning(false);
      if (e instanceof ApiError && e.status === 409) {
        setError("문서 분석이 끝난 뒤에 실행할 수 있어요.");
      } else {
        setError(errorMessage(e, "오타 검증에 실패했습니다."));
      }
    }
  }

  async function updateFinding(findingId: string, next: FindingStatus) {
    if (!result) return;
    const prev = result;
    setResult({
      ...result,
      findings: result.findings.map((f) => (f.id === findingId ? { ...f, status: next } : f)),
    });
    try {
      const updated = await setFindingStatus(docId, result.id, findingId, next);
      setResult(updated);
    } catch (e) {
      setResult(prev);
      setError(errorMessage(e, "상태 변경에 실패했습니다."));
    }
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    setError(null);
    try {
      const res = await applyAnalysis(docId, result.id);
      setApplyResult(res);
      setAppliedAnalysisId(result.id);
      onApplied?.(res.new_version_id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("이미 이 분석으로 교정을 적용했어요. 다시 적용하려면 검사를 새로 실행하세요.");
        setAppliedAnalysisId(result.id);
      } else {
        setError(errorMessage(e, "교정 적용에 실패했습니다."));
      }
    } finally {
      setApplying(false);
    }
  }

  const counts = result
    ? result.findings.reduce<Record<string, number>>((acc, f) => {
        acc[f.category] = (acc[f.category] ?? 0) + 1;
        return acc;
      }, {})
    : {};
  const acceptedCount = result ? result.findings.filter((f) => f.status === "accepted").length : 0;
  // 서버가 내려주는 applied_version_id가 진짜 소스 — 로컬 state(appliedAnalysisId)는 방금 이 세션에서
  // 적용한 경우의 보조 신호일 뿐이라, 새로고침 후에도 적용 버튼이 다시 뜨는 걸 막으려면 이게 필요하다.
  const applyLocked =
    result != null && (result.applied_version_id != null || appliedAnalysisId === result.id);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 p-4">
        <Button
          variant={result ? "outline" : "primary"}
          onClick={run}
          disabled={running || !ready}
          className="w-full justify-center py-2.5"
        >
          {running ? "검사 중…" : result ? "다시 검사" : "AI 오타 검사 실행"}
        </Button>
        {!ready && <p className="text-xs text-ink-muted">문서 분석이 끝나면 실행할 수 있어요.</p>}
        {error && <p className="text-sm text-primary">{error}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {running || result?.status === "RUNNING" ? (
          <div className="flex flex-col items-center gap-2 pt-10 text-center text-sm text-ink-muted">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
            검사 중… 백그라운드에서 처리하고 있어요.
          </div>
        ) : !result || result.status === "FAILED" ? (
          <p className="pt-8 text-center text-sm text-ink-muted">
            {result?.status === "FAILED" ? "검사에 실패했습니다." : "아직 검사 결과가 없습니다."}
          </p>
        ) : result.findings.length === 0 ? (
          <p className="pt-8 text-center text-sm text-ink-muted">발견된 문제가 없습니다</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {Object.entries(counts).map(([c, n]) => (
                <span key={c} className={`rounded-full px-2.5 py-0.5 font-medium ${cat(c).className}`}>
                  {cat(c).label} {n}
                </span>
              ))}
              <span className="ml-auto text-ink-muted">
                {result.provider === "openai" ? "GPT" : "규칙기반"} · 섹션 {result.sections_scanned}개
              </span>
            </div>

            {applyLocked ? (
              <div className="rounded-control border border-border bg-emerald-50 p-3 text-xs text-emerald-700">
                {applyResult ? (
                  <>
                    V{applyResult.new_version_no}에 {applyResult.applied_count}건 적용됨
                    {applyResult.skipped_count > 0 && ` · ${applyResult.skipped_count}건 건너뜀`}
                  </>
                ) : (
                  <>
                    이미 이 분석으로 교정이 적용됐어요
                    {result.applied_at &&
                      ` · ${new Date(result.applied_at).toLocaleString("ko-KR")}`}
                    {" · 최신 버전을 받으려면 다운로드하세요."}
                  </>
                )}
              </div>
            ) : (
              acceptedCount > 0 && (
                <div className="flex flex-col gap-2">
                  <Button onClick={apply} disabled={applying} className="w-full justify-center py-2.5">
                    {applying ? "적용 중…" : `승인된 교정 ${acceptedCount}건 적용`}
                  </Button>
                  {fileExt === "pdf" && (
                    <p className="text-xs text-ink-muted">
                      PDF는 완전 편집이 아니라 시각적 패치로 적용되어 원본과 폰트가 미세하게 다를 수 있어요.
                    </p>
                  )}
                </div>
              )
            )}

            <ul className="flex flex-col gap-2">
              {result.findings.map((f) => {
                /*
                 * 지적된 문구를 넘겨줘서 뷰어가 섹션 전체가 아니라 해당 단어만 표시하게 한다.
                 * applyLocked 상태에서는 뷰어가 이미 적용 후 새 버전의 섹션을 보여주고 있어서
                 * (재파싱으로 section_id가 바뀜) 이 finding의 section_id는 더 이상 존재하지 않는
                 * 옛 버전 것이다 — 그대로 두면 클릭해도 아무것도 안 되는 죽은 버튼이 되므로 감춘다.
                 */
                const jump =
                  !applyLocked && f.section_id != null && onFocusSection
                    ? () => onFocusSection(f.section_id!, f.original)
                    : undefined;
                return (
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
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          cat(f.category).className
                        }`}
                      >
                        {cat(f.category).label}
                      </span>
                      {f.page_start != null && (
                        <span className="font-mono text-xs text-ink-muted">p.{f.page_start}</span>
                      )}
                      {jump && (
                        <button
                          type="button"
                          onClick={jump}
                          className={`ml-auto rounded-sm text-xs text-primary hover:underline ${FOCUS_RING}`}
                        >
                          본문 보기 →
                        </button>
                      )}
                    </div>
                    <p>
                      <span className="text-ink-muted line-through">{f.original}</span>
                      <span className="mx-1.5 text-ink-muted">→</span>
                      <span className="font-medium text-ink">{f.suggestion}</span>
                    </p>
                    {f.reason && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{f.reason}</p>}

                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={applyLocked}
                        onClick={() => updateFinding(f.id, f.status === "accepted" ? "pending" : "accepted")}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          f.status === "accepted"
                            ? "bg-emerald-100 text-emerald-700"
                            : "border border-border text-ink-muted hover:bg-surface"
                        }`}
                      >
                        {f.status === "accepted" ? "승인됨" : "승인"}
                      </button>
                      <button
                        type="button"
                        disabled={applyLocked}
                        onClick={() => updateFinding(f.id, f.status === "rejected" ? "pending" : "rejected")}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          f.status === "rejected"
                            ? "bg-primary-soft text-primary"
                            : "border border-border text-ink-muted hover:bg-surface"
                        }`}
                      >
                        {f.status === "rejected" ? "반려됨" : "반려"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="grid h-full place-items-center py-16 text-center">
      <div className="max-w-xs">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-xs text-ink-muted">{desc}</p>
      </div>
    </div>
  );
}
