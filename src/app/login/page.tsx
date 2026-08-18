"use client";

import { useEffect, useState } from "react";
import { getProviders, loginWith } from "@/lib/auth";

/** /auth/providers에 접근하지 못해도 화면이 렌더링되도록 하는 대체값. */
const FALLBACK = ["google"];

const PROVIDER_META: Record<string, { name: string; icon: string }> = {
  google: { name: "Google", icon: "G" },
  sso: { name: "사내 SSO", icon: "🏢" },
  mock: { name: "개발용 로그인", icon: "🧪" },
};

function meta(key: string) {
  return PROVIDER_META[key] ?? { name: key, icon: "•" };
}

export default function LoginPage() {
  const [providers, setProviders] = useState<string[]>(FALLBACK);

  useEffect(() => {
    getProviders()
      .then((p) => p.length && setProviders(p))
      .catch(() => setProviders(FALLBACK));
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* 브랜드 */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-lg font-bold text-white">
            AX
          </span>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink">사이드 프로젝트</h1>
            <p className="mt-1 text-sm text-ink-muted">계속하려면 로그인하세요.</p>
          </div>
        </div>

        {/* Provider 버튼 */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-canvas p-6">
          {providers.map((key) => {
            const m = meta(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => loginWith(key)}
                className="flex items-center justify-center gap-2.5 rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface"
              >
                <span className="grid h-5 w-5 place-items-center rounded bg-surface-2 text-xs">
                  {m.icon}
                </span>
                {m.name}(으)로 계속하기
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          로그인하면 서비스 이용약관 및 개인정보 처리방침에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}
