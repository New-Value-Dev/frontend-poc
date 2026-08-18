"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSummary, getActivity } from "@/lib/dashboard";
import { listRecentDocuments } from "@/lib/documents";
import { errorMessage, isAuthError } from "@/lib/api";
import { initialsOf } from "@/lib/auth";
import type { ActivityItem, DashboardSummary, RecentDocument } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  SectionTitle,
  ErrorBanner,
  StatusBadge,
  buttonClass,
  statusLabel,
  statusTone,
  FOCUS_RING,
} from "@/components/ui/primitives";
import { AreaTrend, BarList, PipelineStrip } from "@/components/charts";
import { useAuth } from "@/components/auth/AuthProvider";

const POLL_MS = 15_000;

/** `weeklyProcessing`은 **UTC** 기준 일자로 집계되므로 라벨도 UTC 기준이어야 한다. */
function weekdayLabels(len: number): string[] {
  const names = ["일", "월", "화", "수", "목", "금", "토"];
  const today = new Date();
  return Array.from({ length: len }, (_, i) => {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (len - 1 - i)),
    );
    return names[d.getUTCDay()];
  });
}

/**
 * 백엔드가 내려주는 활동 종류는 11가지라 4가지 tone으로 묶는다. 배지 텍스트가 이미
 * kind 이름을 담고 있으므로 색은 개별 식별이 아니라 분류만 나타내면 된다. `analysis`에
 * 처음엔 amber를 썼지만 브랜드 레드와 ΔE 10.6으로 정상 시야 기준(15) 미만이라
 * `destructive`와 함께 쓰지 않도록 뺐다.
 *
 * activity kind는 파이프라인 단계가 아니라 행동 분류이므로 `statusTone`과
 * 별도의 맵으로 유지한다.
 */
const TONE = {
  destructive: "bg-primary-soft text-primary",
  analysis: "bg-violet-50 text-violet-700",
  change: "bg-sky-50 text-sky-700",
  quiet: "bg-surface-2 text-ink-muted",
} as const;

const KIND_TONE: Record<string, keyof typeof TONE> = {
  삭제: "destructive",
  오타: "analysis",
  규정: "analysis",
  분류: "analysis",
  추천: "analysis",
  분석: "analysis",
  업로드: "change",
  프로젝트: "change",
  폴더: "change",
  로그인: "quiet",
  기타: "quiet",
};

/**
 * 두 조건 모두 필수: id는 테이블별로 매겨지므로 `project` 타입 행의 `targetId`가
 * 무관한 *document*를 열어버릴 수 있고(엉뚱한 파일을 조용히 200으로 열람), 로그는
 * 대상보다 오래 남으므로 `targetAlive`로 삭제된 대상을 걸러낸다.
 * `kind`는 표시용 문구일 뿐이라 조용히 깨질 수 있어 의도적으로 검사하지 않는다.
 */
function canLinkToDocument(a: ActivityItem): a is ActivityItem & { targetId: number } {
  return a.targetType === "document" && a.targetId != null && a.targetAlive;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

export function DashboardView() {
  const { user, loading: authLoading } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [recent, setRecent] = useState<RecentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      const [s, a, r] = await Promise.all([
        getSummary(),
        getActivity(10),
        listRecentDocuments(5),
      ]);
      setSummary(s);
      setActivity(a);
      setRecent(r);
      setError(null);
      setNeedLogin(false);
    } catch (e) {
      setError(errorMessage(e, "대시보드를 불러오지 못했습니다."));
      setNeedLogin(isAuthError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // 인증 세션 확인 전에는 로드하지 않아 새로고침 시 "로그인 필요"가 잘못 깜빡이지 않게 한다.
  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, load]);

  const processing = summary?.stats.processing ?? 0;
  useEffect(() => {
    if (processing === 0) return;
    const id = setInterval(() => load({ quiet: true }), POLL_MS);
    return () => clearInterval(id);
  }, [processing, load]);

  if (authLoading || (loading && !summary)) {
    return <DashboardSkeleton />;
  }

  if (error && !summary) {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorBanner message={error} needLogin={needLogin} />
      </div>
    );
  }

  const stats = summary?.stats;
  const weekly = summary?.weeklyProcessing ?? [];
  const weeklyTotal = weekly.reduce((a, b) => a + b, 0);
  const types = summary?.documentTypes ?? [];
  const stages = (summary?.pipeline ?? [])
    .filter((p) => p.status !== "FAILED" || p.count > 0)
    .map((p) => ({
      label: statusLabel(p.status),
      count: p.count,
      tone: p.count > 0 ? statusTone(p.status) : ("idle" as const),
    }));
  const name = user?.name?.trim();

  const tiles = [
    { label: "프로젝트", value: stats?.projects ?? 0 },
    { label: "문서", value: stats?.documents ?? 0 },
    { label: "처리 중", value: processing },
    { label: "오늘 RAG 질의", value: stats?.ragToday ?? 0, note: "RAG 미구현" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          {/* `tracking-tight` 제거: 한글은 자간을 좁히면 가독성이 떨어져서 뺐다 (숫자는 유지, PageHeader 참고). */}
          <h1 className="text-2xl font-semibold text-ink">
            {name ? `안녕하세요, ${name} 님` : "안녕하세요"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {processing > 0 ? (
              <>
                지금 <span className="tnum font-medium text-primary">{processing}건</span>의 문서가
                처리 중입니다.
              </>
            ) : (
              <>
                등록된 문서{" "}
                <span className="tnum font-medium text-primary">{stats?.documents ?? 0}건</span>
                {", 처리 중인 문서는 없습니다."}
              </>
            )}
          </p>
        </div>
        <Link href="/projects" className={buttonClass("primary")}>
          프로젝트 관리
        </Link>
      </header>

      <Card className="grid grid-cols-2 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <StatTile
            key={t.label}
            {...t}
            className={[
              i % 2 === 1 && "border-l border-border",
              i >= 2 && "border-t border-border lg:border-t-0",
              i > 0 && "lg:border-l lg:border-border",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>주간 문서 처리량</CardTitle>
            <span className="text-xs text-ink-muted">
              최근 {weekly.length || 7}일, 총 <span className="tnum">{weeklyTotal}</span>건
            </span>
          </CardHeader>
          <div className="p-4">
            {weekly.length > 0 ? (
              <AreaTrend data={weekly} labels={weekdayLabels(weekly.length)} />
            ) : (
              <Empty className="aspect-[660/240] w-full">표시할 처리 이력이 없습니다.</Empty>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>문서 유형 분포</CardTitle>
          </CardHeader>
          <div className="p-5">
            {types.length > 0 ? (
              <BarList items={types} />
            ) : (
              <Empty className="min-h-[120px]">등록된 문서가 없습니다.</Empty>
            )}
          </div>
        </Card>
      </div>

      <section className="border-t border-border pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SectionTitle>문서 처리 파이프라인</SectionTitle>
          <span className="flex items-center gap-2 text-xs text-ink-muted">
            {processing > 0 && (
              <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            )}
            {processing > 0 ? "15초마다 갱신" : "현재 버전 기준"}
          </span>
        </div>
        {stages.length > 0 ? (
          <PipelineStrip stages={stages} />
        ) : (
          <Empty className="py-6">집계할 문서가 없습니다.</Empty>
        )}
      </section>

      {/* 최근 문서 + 최근 활동 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>최근 문서</CardTitle>
            <Link
              href="/projects"
              className={`rounded-sm text-xs font-medium text-primary hover:underline ${FOCUS_RING}`}
            >
              전체 보기
            </Link>
          </CardHeader>
          {recent.length > 0 ? (
            <ul className="divide-y divide-border">
              {recent.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/documents/${d.id}`}
                    className={`flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface ${FOCUS_RING} focus-visible:ring-offset-0`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-muted">
                        <IconDoc />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                        <p className="truncate text-xs text-ink-muted">{d.project_name}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={d.processing_status} />
                      <span className="text-xs text-ink-muted">{relativeTime(d.created_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="px-5 py-10">
              아직 등록된 문서가 없습니다.{" "}
              <Link
                href="/projects"
                className={`rounded-sm font-medium text-primary hover:underline ${FOCUS_RING}`}
              >
                프로젝트
              </Link>
              에서 업로드하세요.
            </Empty>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
            <span className="text-xs text-ink-muted">최근 {activity.length}건</span>
          </CardHeader>
          {activity.length > 0 ? (
            <ul className="divide-y divide-border">
              {activity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                    {initialsOf({ name: a.actor, email: a.actor })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <span className="font-medium">{a.actor}</span>
                      <span className="text-ink-muted"> · {a.action}</span>
                    </p>
                    {/* `로그인`처럼 대상이 없는 활동은 `target`이 빈 문자열이다. */}
                    {a.target &&
                      (canLinkToDocument(a) ? (
                        <Link
                          href={`/documents/${a.targetId}`}
                          className={`block truncate rounded-sm text-xs text-ink-muted transition-colors hover:text-primary hover:underline ${FOCUS_RING}`}
                        >
                          {a.target}
                        </Link>
                      ) : (
                        <p className="truncate text-xs text-ink-muted">{a.target}</p>
                      ))}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        TONE[KIND_TONE[a.kind] ?? "quiet"]
                      }`}
                    >
                      {a.kind}
                    </span>
                    <span className="text-xs text-ink-muted">{relativeTime(a.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="px-5 py-10">아직 활동 기록이 없습니다.</Empty>
          )}
        </Card>
      </div>

      {/* 첫 렌더 이후의 갱신 실패는 이미 표시된 수치를 지우지 않아야 한다. */}
      {error && summary && <ErrorBanner message={error} needLogin={needLogin} />}
    </div>
  );
}

function StatTile({
  label,
  value,
  note,
  className = "",
}: {
  label: string;
  value: number;
  note?: string;
  className?: string;
}) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1.5 font-mono text-3xl font-semibold tracking-tight text-ink">
        {value.toLocaleString("ko-KR")}
      </p>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

function Empty({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <p className="text-center text-sm text-ink-muted">{children}</p>
    </div>
  );
}

function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl animate-pulse flex-col gap-8" aria-busy>
      <div className="flex items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-2.5">
          <div className="h-7 w-64 rounded bg-surface-2" />
          <div className="h-4 w-48 rounded bg-surface" />
        </div>
        <div className="h-9 w-28 rounded-control bg-surface-2" />
      </div>

      <Card className="grid grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`flex flex-col gap-2.5 px-5 py-4 ${
              [
                i % 2 === 1 && "border-l border-border",
                i >= 2 && "border-t border-border lg:border-t-0",
                i > 0 && "lg:border-l lg:border-border",
              ]
                .filter(Boolean)
                .join(" ")
            }`}
          >
            <div className="h-4 w-20 rounded bg-surface" />
            <div className="h-8 w-16 rounded bg-surface-2" />
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="h-[345px] rounded-panel border border-border bg-surface lg:col-span-2" />
        <div className="h-[170px] rounded-panel border border-border bg-surface" />
      </div>

      <div className="border-t border-border pt-6">
        <div className="mb-4 h-5 w-40 rounded bg-surface-2" />
        <div className="h-[62px] rounded-panel border border-border bg-surface" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-[300px] rounded-panel border border-border bg-surface" />
        <div className="h-[300px] rounded-panel border border-border bg-surface" />
      </div>
    </div>
  );
}
