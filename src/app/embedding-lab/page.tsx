"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ErrorBanner, FOCUS_RING, PageHeader } from "@/components/ui/primitives";
import { ModelsPanel } from "@/components/embedding-lab/ModelsPanel";
import { BenchmarkPanel } from "@/components/embedding-lab/BenchmarkPanel";
import { MigrationPanel } from "@/components/embedding-lab/MigrationPanel";

const tabs = [
  { key: "models", label: "모델" },
  { key: "benchmark", label: "벤치마크" },
  { key: "migration", label: "마이그레이션" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function EmbeddingLabPage() {
  const { user, loading: authLoading } = useAuth();
  const [active, setActive] = useState<TabKey>("models");

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorBanner message="Embedding Lab을 사용하려면 로그인이 필요합니다." needLogin />
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorBanner message="Embedding Lab은 관리자만 사용할 수 있습니다." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Embedding Lab"
        description="실제 프로젝트 문서 기반 벤치마크로 임베딩 모델을 비교하고, 활성 모델을 선정하고, 기존 문서를 마이그레이션합니다."
      />

      <div className="flex gap-1 border-b border-border">
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

      {active === "models" && <ModelsPanel />}
      {active === "benchmark" && <BenchmarkPanel />}
      {active === "migration" && <MigrationPanel />}
    </div>
  );
}
