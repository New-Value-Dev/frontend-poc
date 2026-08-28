"use client";

import { useEffect, useState } from "react";
import { listUsageLogs } from "@/lib/admin";
import { errorMessage } from "@/lib/api";
import { Card, CardHeader, CardTitle, ErrorBanner, LLMCallStatusBadge } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { Pager } from "@/components/ui/Pager";
import type { LLMUsageLogPage } from "@/lib/types";
import { featureLabel, formatDateTime, formatNumber } from "./aiOpsFormat";

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "success", label: "성공" },
  { value: "fail", label: "실패" },
];

const FEATURE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "proofread", label: "맞춤법 검사" },
  { value: "rag_answer", label: "RAG 챗봇" },
  { value: "quiz_generate", label: "AI 문제 생성" },
];

const SIZE = 20;

export function UsageLogsPanel() {
  const [feature, setFeature] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LLMUsageLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    listUsageLogs({ feature: feature || undefined, status: status || undefined, page, size: SIZE })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "호출 로그를 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feature, status, page]);

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap gap-2">
        <Dropdown
          variant="chip"
          label="기능"
          value={feature}
          onChange={(v) => {
            setFeature(v);
            setPage(1);
          }}
          options={FEATURE_OPTIONS}
        />
        <Dropdown
          variant="chip"
          label="상태"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>LLM 호출 로그</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted">
                <th className="px-5 py-2.5 font-medium">시각</th>
                <th className="px-5 py-2.5 font-medium">기능</th>
                <th className="px-5 py-2.5 font-medium">모델</th>
                <th className="px-5 py-2.5 font-medium">상태</th>
                <th className="px-5 py-2.5 font-medium">토큰</th>
                <th className="px-5 py-2.5 font-medium">지연시간</th>
                <th className="px-5 py-2.5 font-medium">오류</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading &&
                data?.items.map((log) => (
                  <tr key={log.id} className="hover:bg-surface">
                    <td className="px-5 py-2.5 text-ink-muted">{formatDateTime(log.created_at)}</td>
                    <td className="px-5 py-2.5 text-ink">{featureLabel(log.feature)}</td>
                    <td className="px-5 py-2.5 text-ink-muted">{log.model}</td>
                    <td className="px-5 py-2.5">
                      <LLMCallStatusBadge status={log.status} />
                    </td>
                    <td className="px-5 py-2.5 tnum text-ink-muted">
                      {log.total_tokens == null ? "-" : formatNumber(log.total_tokens)}
                    </td>
                    <td className="px-5 py-2.5 tnum text-ink-muted">
                      {log.latency_ms == null ? "-" : `${formatNumber(Math.round(log.latency_ms))}ms`}
                    </td>
                    <td className="max-w-xs truncate px-5 py-2.5 text-ink-muted" title={log.error_message ?? undefined}>
                      {log.error_message ?? "-"}
                    </td>
                  </tr>
                ))}
              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-muted">
                    조건에 맞는 로그가 없습니다.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-muted">
                    불러오는 중…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > 0 && (
          <Pager page={data.page} size={data.size} total={data.total} onChange={setPage} />
        )}
      </Card>
    </div>
  );
}
