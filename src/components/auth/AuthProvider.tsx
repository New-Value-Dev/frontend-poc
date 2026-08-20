"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { bootstrapSession, logout as apiLogout } from "@/lib/auth";
import type { User } from "@/lib/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const SESSION_TIMEOUT_MS = 10_000;

/**
 * 마운트 시 refresh 쿠키를 access token으로 교환한 뒤 현재 사용자를 불러와 세션을
 * 초기화한다. 백엔드가 없으면 그냥 `user: null`로 정리되어 앱은 mock 상태로 동작한다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const failsafe = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, SESSION_TIMEOUT_MS);

    bootstrapSession()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
    };
  }, []);

  async function logout() {
    await apiLogout();
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
