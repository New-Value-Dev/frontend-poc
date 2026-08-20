"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getMyPageSummary } from "@/lib/mypage";
import { errorMessage, isAuthError } from "@/lib/api";
import { initialsOf } from "@/lib/auth";
import type { MyPageSummary } from "@/lib/types";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  Button,
  Tag,
  ErrorBanner,
} from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("ko-KR") : "-";
}

export default function MyPage() {
  const { loading: authLoading, logout } = useAuth();
  const [summary, setSummary] = useState<MyPageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getMyPageSummary();
      setSummary(s);
      setError(null);
      setNeedLogin(false);
    } catch (e) {
      setError(errorMessage(e, "마이페이지를 불러오지 못했습니다."));
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

  if (authLoading || (loading && !summary)) {
    return <MyPageSkeleton />;
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBanner message={error ?? "마이페이지를 불러오지 못했습니다."} needLogin={needLogin} />
      </div>
    );
  }

  const { profile, stats, recentActivity } = summary;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="마이페이지" description="계정 정보와 내 활동을 확인합니다." />

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-lg font-semibold text-white">
            {initialsOf(profile)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">
              {profile.name ?? "이름 없음"}
            </p>
            <p className="truncate text-sm text-ink-muted">{profile.email}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm">
          <div>
            <dt className="text-ink-muted">권한</dt>
            <dd className="mt-1">
              <Tag>{profile.role}</Tag>
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">로그인 방식</dt>
            <dd className="mt-1">
              <Tag>{profile.provider}</Tag>
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">가입일</dt>
            <dd className="mt-1 font-medium text-ink">{fmtDate(profile.memberSince)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">최근 로그인</dt>
            <dd className="mt-1 font-medium text-ink">{fmtDate(profile.lastLoginAt)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex justify-end border-t border-border pt-5">
          <Button variant="outline" onClick={logout}>
            로그아웃
          </Button>
        </div>
      </Card>

      <Card className="grid grid-cols-3">
        <StatCell label="내 프로젝트" value={stats.projects} />
        <StatCell label="내 문서" value={stats.documents} className="border-l border-border" />
        <StatCell label="처리 중" value={stats.processing} className="border-l border-border" />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>내 최근 활동</CardTitle>
          <span className="text-xs text-ink-muted">최근 {recentActivity.length}건</span>
        </CardHeader>
        {recentActivity.length > 0 ? (
          <ActivityFeed items={recentActivity} />
        ) : (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">아직 활동 기록이 없습니다.</p>
        )}
      </Card>

      {/* 첫 렌더 이후의 갱신 실패는 이미 표시된 정보를 지우지 않는다. */}
      {error && summary && <ErrorBanner message={error} needLogin={needLogin} />}
    </div>
  );
}

function StatCell({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="tnum mt-1.5 font-mono text-2xl font-semibold text-ink">
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

function MyPageSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl animate-pulse flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-2.5">
        <div className="h-7 w-28 rounded bg-surface-2" />
        <div className="h-4 w-56 rounded bg-surface" />
      </div>
      <div className="h-[236px] rounded-panel border border-border bg-surface" />
      <div className="h-[84px] rounded-panel border border-border bg-surface" />
      <div className="h-64 rounded-panel border border-border bg-surface" />
    </div>
  );
}
