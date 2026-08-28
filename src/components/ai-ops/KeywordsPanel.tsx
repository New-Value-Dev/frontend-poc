"use client";

import { useEffect, useState } from "react";
import { getSearchKeywords } from "@/lib/admin";
import { errorMessage } from "@/lib/api";
import { Card, CardHeader, CardTitle, ErrorBanner } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/Dropdown";
import type { AdminUsagePeriod, KeywordRanking } from "@/lib/types";
import { formatNumber } from "./aiOpsFormat";

const PERIOD_OPTIONS = [
  { value: "day", label: "오늘" },
  { value: "month", label: "이번 달" },
  { value: "year", label: "올해" },
];

export function KeywordsPanel() {
  const [period, setPeriod] = useState<AdminUsagePeriod>("month");
  const [ranking, setRanking] = useState<KeywordRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    getSearchKeywords(period, 30)
      .then((r) => {
        if (!cancelled) setRanking(r);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "키워드 순위를 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const items = ranking?.items ?? [];
  const maxCount = items[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-end">
        <Dropdown
          variant="chip"
          label="기간"
          value={period}
          onChange={(v) => setPeriod(v as AdminUsagePeriod)}
          options={PERIOD_OPTIONS}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>RAG 챗봇 검색 키워드 순위</CardTitle>
          <span className="text-xs text-ink-muted">질문 형태소 분석 기준 상위 {items.length}개</span>
        </CardHeader>
        <div className="flex flex-col gap-2 p-5">
          {loading && <p className="text-sm text-ink-muted">불러오는 중…</p>}
          {!loading &&
            items.map((item, i) => (
              <div key={item.keyword} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-right text-xs text-ink-muted tnum">{i + 1}</span>
                <span className="w-24 shrink-0 truncate text-sm text-ink">{item.keyword}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-ink-muted tnum">
                  {formatNumber(item.count)}
                </span>
              </div>
            ))}
          {!loading && items.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-muted">이 기간에 검색 기록이 없습니다.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
