/*
 * AX 백엔드용 타입 fetch 래퍼.
*/

const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? "8000";

function computeApiOrigin(): string {
  const override = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (override) return override.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

const BASE_URL = computeApiOrigin() + "/api/v1";

/* --- access token은 메모리에만 보관 (refresh token은 httpOnly 쿠키) --- */
let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** 인증 실패(401/403)일 때만 true — 로그인 유도 여부 판단에 사용. */
export function isAuthError(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

/** 어떤 예외든 사람이 읽을 수 있는 메시지로 변환. */
export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

const REFRESH_PATH = "/auth/token/refresh";

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}${REFRESH_PATH}`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token?: string };
    if (data.access_token) {
      setAccessToken(data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** multipart/form-data 업로드 — body에 FormData를 넣고 이 값을 true로 설정 */
  form?: boolean;
  /** 내부용: refresh 재귀 무한 반복 방지 */
  _retried?: boolean;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, form, _retried, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (accessToken) finalHeaders.set("Authorization", `Bearer ${accessToken}`);

  let payload: BodyInit | undefined;
  if (form) {
    payload = body as FormData; // multipart boundary는 브라우저가 자동 설정
  } else if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: payload,
    credentials: "include",
  });

  // 401 응답 시 (refresh 요청 자체는 제외) 토큰 갱신 후 한 번 재시도.
  if (res.status === 401 && !_retried && path !== REFRESH_PATH) {
    if (await tryRefresh()) {
      return request<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = (await res.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      /* JSON이 아닌 에러 응답 */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

export { BASE_URL };
