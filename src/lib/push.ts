import { api } from "./api";
import type { PublicKeyResponse, PushSubscribeRequest } from "./types";

/**
 * Web Push 구독 관리. 구독 등록/해제는 **반드시 메인 스레드에서** 한다 —
 * 서비스워커(`public/sw.js`)는 access token을 다루지 않는다.
 *
 * Turbopack에서 `next-pwa`가 동작하지 않으므로 SW 등록도 직접 한다.
 */

const SW_PATH = "/sw.js";

export const SW_NOTIFICATION_MESSAGE = "notification";

export type PushState = "unsupported" | "insecure" | "denied" | "subscribed" | "unsubscribed";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isSecureForPush(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported() || !isSecureForPush()) return Promise.resolve(null);
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" }).catch(() => null);
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  await registerServiceWorker();
  return navigator.serviceWorker.ready;
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (!isSecureForPush()) return "insecure";
  if (Notification.permission === "denied") return "denied";
  // 인자 없는 getRegistration()은 현재 문서를 담당하는 등록을 찾는다 — scope가 `/`라 항상 이것이다.
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "subscribed" : "unsubscribed";
}

export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) throw new Error("이 브라우저는 푸시 알림을 지원하지 않습니다.");
  if (!isSecureForPush()) {
    throw new Error("HTTPS 또는 localhost에서만 푸시 알림을 설정할 수 있습니다.");
  }

  const { public_key } = await api.get<PublicKeyResponse>("/push/public-key");
  if (!public_key) throw new Error("서버에 푸시 키(VAPID)가 설정되지 않았습니다.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("브라우저에서 알림 권한이 허용되지 않았습니다.");

  const registration = await readyRegistration();
  const applicationServerKey = base64UrlToArrayBuffer(public_key);

  const existing = await registration.pushManager.getSubscription();
  if (existing && !usesKey(existing, applicationServerKey)) {
    await existing.unsubscribe();
  }
  const subscription =
    (usesKey(existing, applicationServerKey) ? existing : null) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }));

  await api.post<void>("/push/subscribe", toSubscribeRequest(subscription));
}

function usesKey(subscription: PushSubscription | null, key: ArrayBuffer): boolean {
  if (!subscription) return false;
  const current = subscription.options.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current as ArrayBuffer);
  const b = new Uint8Array(key);
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await api.delete<void>("/push/subscribe", { body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}

function toSubscribeRequest(subscription: PushSubscription): PushSubscribeRequest {
  const json = subscription.toJSON();
  const keys = json.keys ?? {};
  if (!keys.p256dh || !keys.auth) {
    throw new Error("브라우저가 푸시 암호화 키를 주지 않았습니다. 다시 시도해 주세요.");
  }
  return { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function setAppBadge(unread: number): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as BadgeNavigator;
  const promise = unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.();
  // 권한/지원 문제로 거부되면 조용히 넘긴다 — 뱃지는 부가 기능이다.
  promise?.catch(() => {});
}
