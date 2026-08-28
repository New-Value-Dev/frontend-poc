"use client";

import { useEffect, useState } from "react";
import { listRagLogs } from "@/lib/admin";
import { errorMessage } from "@/lib/api";
import { Card, CardHeader, CardTitle, ErrorBanner } from "@/components/ui/primitives";
import { Pager } from "@/components/ui/Pager";
import type { RagAdminLog, RagAdminLogPage } from "@/lib/types";
import { formatDateTime, formatNumber } from "./aiOpsFormat";

const SIZE = 20;
const ANSWER_PREVIEW_LENGTH = 80;

export function RagLogsPanel() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RagAdminLogPage | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    listRagLogs({ page, size: SIZE })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "검색·답변 로그를 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>검색-답변 로그</CardTitle>
          <span className="text-xs text-ink-muted">전체 사용자 대상</span>
        </CardHeader>
        <div className="flex flex-col divide-y divide-border">
          {!loading &&
            data?.items.map((log) => (
              <RagLogRow
                key={log.message_id}
                log={log}
                open={expanded === log.message_id}
                onToggle={() =>
                  setExpanded((prev) => (prev === log.message_id ? null : log.message_id))
                }
              />
            ))}
          {!loading && data?.items.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">기록이 없습니다.</p>
          )}
          {loading && <p className="px-5 py-8 text-center text-sm text-ink-muted">불러오는 중…</p>}
        </div>
        {data && data.total > 0 && (
          <Pager page={data.page} size={data.size} total={data.total} onChange={setPage} />
        )}
      </Card>
    </div>
  );
}

function RagLogRow({
  log,
  open,
  onToggle,
}: {
  log: RagAdminLog;
  open: boolean;
  onToggle: () => void;
}) {
  const preview =
    log.answer.length > ANSWER_PREVIEW_LENGTH
      ? `${log.answer.slice(0, ANSWER_PREVIEW_LENGTH)}…`
      : log.answer;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full flex-col gap-1.5 px-5 py-3.5 text-left hover:bg-surface"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
        <span>
          사용자 #{log.user_id} · {formatDateTime(log.created_at)}
        </span>
        <span className="shrink-0">
          {log.latency_ms != null && `${formatNumber(Math.round(log.latency_ms))}ms`}
          {log.retrieved_count != null && ` · 근거 ${log.retrieved_count}건`}
        </span>
      </div>
      <p className="text-sm font-medium text-ink">{log.question ?? "(질문 없음)"}</p>
      <p className="text-sm text-ink-muted">{open ? log.answer : preview}</p>
      {open && log.citations && log.citations.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1 rounded-control bg-surface p-2.5 text-xs text-ink-muted">
          {log.citations.map((c, i) => (
            <span key={i}>
              📄 {String(c.document_name ?? c.source ?? JSON.stringify(c))}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
