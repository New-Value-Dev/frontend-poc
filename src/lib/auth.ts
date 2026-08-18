import { api, BASE_URL, setAccessToken } from "./api";
import type { ProvidersResponse, User, TokenResponse } from "./types";

/** /login 화면에서 사용 가능한 로그인 provider 키 목록 (예: ["google"]). */
export async function getProviders(): Promise<string[]> {
  const { providers } = await api.get<ProvidersResponse>("/auth/providers");
  return providers;
}

/**
 * 백엔드 OAuth 진입점으로 풀페이지 리다이렉트. 백엔드가 redirect_uri를 계산해 IdP로
 * 보냈다가, (자체 /auth/callback을 통해) refresh 쿠키를 설정하고 `${frontend}/auth/callback`
 * 으로 되돌린다. `origin`은 Referer 헤더에 맡기지 않고 명시적으로 전달하는데, PC(localhost)와
 * 휴대폰(LAN IP/도메인) 모두 실제로 시작한 호스트로 돌아오게 하기 위해서다 —
 * 인앱 브라우저나 프라이버시 설정에서 Referer가 제거될 수 있다.
 */
export function loginWith(provider: string) {
  const origin = encodeURIComponent(window.location.origin);
  // 백엔드 origin으로의 외부 이동 — Next 내부 라우팅이 아님.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${BASE_URL}/auth/login/${provider}?origin=${origin}`;
}

/** 현재 사용자 정보 (Bearer 토큰 필요). */
export function getMe() {
  return api.get<User>("/auth/me");
}

/** refresh 쿠키로 새 access token을 발급받아 메모리에 저장. */
export async function bootstrapSession(): Promise<User | null> {
  try {
    const { access_token } = await api.post<TokenResponse>("/auth/token/refresh");
    setAccessToken(access_token);
    return await getMe();
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    setAccessToken(null);
  }
}

/** 백엔드 `/me`에는 아바타/이니셜이 없으므로 이름이나 이메일로부터 직접 만든다. */
export function initialsOf(user: Pick<User, "name" | "email">): string {
  const base = (user.name?.trim() || user.email || "").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}
