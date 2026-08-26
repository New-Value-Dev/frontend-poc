"use client";

import { useEffect, useRef, useState } from "react";
import { getJob } from "@/lib/embedding";
import { EmbeddingJobStatusBadge, ErrorBanner } from "@/components/ui/primitives";
import type { EmbeddingJob } from "@/lib/types";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 5분

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function JobProgress({
  jobId,
  onDone,
}: {
  jobId: number;
  onDone?: (job: EmbeddingJob) => void;
}) {
  const [job, setJob] = useState<EmbeddingJob | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJob(null);
    setTimedOut(false);

    async function poll() {
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        let current: EmbeddingJob;
        try {
          current = await getJob(jobId);
        } catch {
          if (cancelled) return;
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        if (cancelled) return;
        setJob(current);
        if (current.status === "COMPLETED" || current.status === "FAILED") {
          onDoneRef.current?.(current);
          return;
        }
        await sleep(POLL_INTERVAL_MS);
      }
      if (!cancelled) setTimedOut(true);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const pct = job && job.target_count > 0 ? Math.min(100, Math.round((job.processed_count / job.target_count) * 100)) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-control border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink">
          {job?.job_type === "migrate" ? "마이그레이션" : "재임베딩"} 작업 #{jobId}
        </span>
        {job && <EmbeddingJobStatusBadge status={job.status} />}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all ${job?.status === "FAILED" ? "bg-primary" : "bg-primary"}`}
          style={{ width: `${job?.status === "RUNNING" ? Math.max(pct, 4) : pct}%` }}
        />
      </div>
      <p className="text-xs text-ink-muted">
        {job ? `${job.processed_count} / ${job.target_count} 처리됨` : "작업 정보를 불러오는 중…"}
      </p>
      {job?.status === "FAILED" && job.error && <ErrorBanner message={job.error} />}
      {timedOut && <ErrorBanner message="진행 상황 조회가 시간 초과되었습니다. 새로고침해 확인해 주세요." />}
    </div>
  );
}
