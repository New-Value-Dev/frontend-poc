"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ErrorBanner, FOCUS_RING, PageHeader } from "@/components/ui/primitives";
import { UsagePanel } from "@/components/ai-ops/UsagePanel";
import { KeywordsPanel } from "@/components/ai-ops/KeywordsPanel";
import { UsageLogsPanel } from "@/components/ai-ops/UsageLogsPanel";
import { RagLogsPanel } from "@/components/ai-ops/RagLogsPanel";

const tabs = [
  { key: "usage", label: "토큰 사용량" },
  { key: "keywords", label: "검색 키워드 순위" },
  { key: "logs", label: "호출 로그" },
  { key: "rag", label: "검색·답변 로그" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function AiOpsPage() {
  const { user, loading: authLoading } = useAuth();
  const [active, setActive] = useState<TabKey>("usage");

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorBanner message="AI 운영 대시보드를 사용하려면 로그인이 필요합니다." needLogin />
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorBanner message="AI 운영 대시보드는 관리자만 사용할 수 있습니다." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="AI 운영 대시보드"
      />

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            aria-current={active === t.key ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-t-control px-3.5 py-2.5 text-sm transition-colors ${FOCUS_RING} focus-visible:ring-offset-0 ${
              active === t.key
                ? "border-b-2 border-primary font-medium text-primary"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "usage" && <UsagePanel />}
      {active === "keywords" && <KeywordsPanel />}
      {active === "logs" && <UsageLogsPanel />}
      {active === "rag" && <RagLogsPanel />}
    </div>
  );
}
