"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "@/components/auth/AuthProvider";

/** 앱 셸(사이드바/톱바) 없이 렌더링되는 라우트. */
const BARE_PREFIXES = ["/login", "/auth"];

/*
 * 클라이언트 사이드 인증 가드. refresh 쿠키는 백엔드 origin 소유라 프론트가
 * 프록시/미들웨어로 라우트를 막을 수 없어, hydrate된 세션에 반응하는 방식을 쓴다.
 * NEXT_PUBLIC_AUTH_ENABLED로 켜고 끌 수 있어 인증이 꺼져 있으면 mock UI가 그대로 보인다.
 */
const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const bare = BARE_PREFIXES.some((p) => pathname.startsWith(p));
  const needsAuth = AUTH_ENABLED && !bare;

  useEffect(() => {
    if (needsAuth && !loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [needsAuth, loading, user, pathname, router]);

  if (bare) return <>{children}</>;

  // 세션이 확인/존재할 때까지 보호된 콘텐츠를 막는다.
  if (needsAuth && (loading || !user)) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface text-sm text-ink-muted">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-surface px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
