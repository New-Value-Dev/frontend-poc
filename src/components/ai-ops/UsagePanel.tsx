"use client";

import { useEffect, useState } from "react";
import { AreaTrend } from "@/components/charts";
import { getBillingSummary, getUsageSummary } from "@/lib/admin";
import { errorMessage } from "@/lib/api";
import { Card, CardHeader, CardTitle, ErrorBanner, InfoTooltip } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/Dropdown";
import type { AdminUsagePeriod, BillingSummary, UsageSummary } from "@/lib/types";
import { featureLabel, formatChartDay, formatDate, formatKrw, formatNumber, formatUsd } from "./aiOpsFormat";

const PERIOD_OPTIONS = [
  { value: "day", label: "오늘" },
  { value: "month", label: "이번 달" },
  { value: "year", label: "올해" },
];

type ChartGranularity = "day" | "month" | "year";

const CHART_OPTIONS = [
  { value: "day", label: "일별" },
  { value: "month", label: "월별" },
  { value: "year", label: "올해" },
];

type CostPoint = { label: string; usd: number; krw: number };

export function UsagePanel() {
  const [period, setPeriod] = useState<AdminUsagePeriod>("month");
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("day");
  const [monthSummary, setMonthSummary] = useState<UsageSummary | null>(null);
  const [yearSummary, setYearSummary] = useState<UsageSummary | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChartError(null);
    getUsageSummary("month")
      .then((m) => {
        if (!cancelled) setMonthSummary(m);
      })
      .catch((e) => {
        if (!cancelled) setChartError(errorMessage(e, "비용 추이를 불러오지 못했습니다."));
      });
    getUsageSummary("year")
      .then((y) => {
        if (!cancelled) setYearSummary(y);
      })
      .catch((e) => {
        if (!cancelled) setChartError(errorMessage(e, "비용 추이를 불러오지 못했습니다."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    getUsageSummary(period)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "토큰 사용량을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    getBillingSummary()
      .then((b) => {
        if (!cancelled) setBilling(b);
      })
      .catch(() => {
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byFeature = summary ? Object.entries(summary.by_feature) : [];

  const rate = billing?.usd_krw_rate ?? 0;

  const dayPoints: CostPoint[] = monthSummary
    ? Object.entries(monthSummary.by_day)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, bucket]) => ({
          label: formatChartDay(date),
          usd: bucket.estimated_cost_usd,
          krw: bucket.estimated_cost_usd * rate,
        }))
    : [];

  const monthPoints: CostPoint[] = yearSummary
    ? (() => {
        const byMonth = new Map<string, number>();
        for (const [date, bucket] of Object.entries(yearSummary.by_day)) {
          const key = date.slice(0, 7);
          byMonth.set(key, (byMonth.get(key) ?? 0) + bucket.estimated_cost_usd);
        }
        return [...byMonth.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, usd]) => ({ label: `${Number(month.slice(5, 7))}월`, usd, krw: usd * rate }));
      })()
    : [];

  const yearPoints: CostPoint[] = yearSummary
    ? [
        {
          label: `${new Date().getFullYear()}년`,
          usd: yearSummary.total.estimated_cost_usd,
          krw: yearSummary.total.estimated_cost_usd * rate,
        },
      ]
    : [];

  const chartPoints =
    chartGranularity === "day" ? dayPoints : chartGranularity === "month" ? monthPoints : yearPoints;
  const chartLoading =
    (chartGranularity === "day" && monthSummary == null) ||
    (chartGranularity !== "day" && yearSummary == null);

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-ink">조회 기간</p>
          <InfoTooltip text="estimated_cost_usd는 백엔드에 등록된 모델별 단가표 기준 추정치입니다. 현재 설정된 모델이 단가표에 없으면 0으로 나올 수 있어요 — 토큰 개수 자체는 정확합니다." />
        </div>
        <Dropdown
          variant="chip"
          label="기간"
          value={period}
          onChange={(v) => setPeriod(v as AdminUsagePeriod)}
          options={PERIOD_OPTIONS}
        />
      </div>

      {loading && !summary && <p className="text-sm text-ink-muted">불러오는 중…</p>}

      {summary && (
        <>
          {summary.source === "estimated" && (
            <p className="text-xs text-ink-muted">
              총 호출·총 토큰은 로컬 로그 기준 추정치입니다(계측 시작 이후만 집계)
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="총 호출" value={formatNumber(summary.total.calls)} />
            <StatTile label="총 토큰" value={formatNumber(summary.total.total_tokens)} />
            <StatTile label="호출당 평균 토큰" value={formatNumber(Math.round(summary.avg_tokens_per_call))} />
            <StatTile label="호출당 평균 비용" value={formatUsd(summary.avg_cost_per_call_usd)} />
          </div>

        </>
      )}

      {billing && (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <CardTitle>비용 요약</CardTitle>
            {billing.cost_source === "estimated" && (
              <span className="text-xs text-ink-muted">
                실제 청구액 연동 대기 중 — 아래는 로컬 추정치(계측 시작 이후만 집계)입니다
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BillingTile label="오늘 비용" usd={billing.today_usd} krw={billing.today_krw} />
            <BillingTile label="이번 달 비용" usd={billing.this_month_usd} krw={billing.this_month_krw} />
          </div>
          {billing.actual_available && billing.daily_actual.length > 0 && (
            <div className="overflow-x-auto border-t border-border pt-3">
              <table className="w-full min-w-[420px] whitespace-nowrap text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-muted">
                    <th className="py-1.5 font-medium">날짜</th>
                    <th className="py-1.5 font-medium">실제 청구액(USD)</th>
                    <th className="py-1.5 font-medium">KRW</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {billing.daily_actual.map((d) => (
                    <tr key={d.date}>
                      <td className="py-1.5 text-ink-muted">{formatDate(d.date)}</td>
                      <td className="py-1.5 tnum text-ink">{formatUsd(d.amount_usd)}</td>
                      <td className="py-1.5 tnum text-ink-muted">{formatKrw(d.amount_krw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>비용 추이</CardTitle>
          <Dropdown
            variant="chip"
            label="단위"
            value={chartGranularity}
            onChange={(v) => setChartGranularity(v as ChartGranularity)}
            options={CHART_OPTIONS}
          />
        </CardHeader>
        <div className="p-5">
          {chartError && <ErrorBanner message={chartError} />}
          {!chartError && chartLoading && (
            <p className="py-8 text-center text-sm text-ink-muted">불러오는 중…</p>
          )}
          {!chartError && !chartLoading && chartPoints.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-muted">데이터가 없습니다.</p>
          )}
          {chartGranularity === "year" && chartPoints.length === 1 ? (
            <div className="flex flex-col items-center gap-1 py-6">
              <p className="text-xs text-ink-muted">{chartPoints[0].label} 추정 비용 합계</p>
              <p className="text-3xl font-semibold text-ink tnum">{formatUsd(chartPoints[0].usd)}</p>
              <p className="text-sm text-ink-muted tnum">{formatKrw(chartPoints[0].krw)}</p>
            </div>
          ) : (
            chartPoints.length > 0 && (
              <AreaTrend
                data={chartPoints.map((p) => p.usd)}
                labels={chartPoints.map((p) => p.label)}
                tooltip={(i) =>
                  `${chartPoints[i].label}\nUSD ${formatUsd(chartPoints[i].usd)}\nKRW ${formatKrw(chartPoints[i].krw)}`
                }
                ariaLabel={`토큰 비용 추이(${chartGranularity === "day" ? "일별" : "월별"}). ${chartPoints
                  .map((p) => `${p.label} ${formatUsd(p.usd)}`)
                  .join(", ")}.`}
              />
            )
          )}
        </div>
      </Card>

      {summary && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>기능별 사용량</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-5 py-2.5 font-medium">기능</th>
                  <th className="px-5 py-2.5 font-medium">호출</th>
                  <th className="px-5 py-2.5 font-medium">토큰</th>
                  <th className="px-5 py-2.5 font-medium">추정 비용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byFeature.map(([feature, bucket]) => (
                  <tr key={feature}>
                    <td className="px-5 py-2.5 text-ink">{featureLabel(feature)}</td>
                    <td className="px-5 py-2.5 tnum text-ink-muted">{formatNumber(bucket.calls)}</td>
                    <td className="px-5 py-2.5 tnum text-ink-muted">
                      {formatNumber(bucket.total_tokens)}
                    </td>
                    <td className="px-5 py-2.5 tnum text-ink-muted">
                      {formatUsd(bucket.estimated_cost_usd)}
                    </td>
                  </tr>
                ))}
                {byFeature.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-ink-muted">
                      이 기간에 호출 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink tnum">{value}</p>
    </Card>
  );
}

function BillingTile({ label, usd, krw }: { label: string; usd: number; krw: number }) {
  return (
    <div className="rounded-control bg-surface p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink tnum">{formatUsd(usd)}</p>
      <p className="mt-0.5 text-xs text-ink-muted tnum">{formatKrw(krw)}</p>
    </div>
  );
}
