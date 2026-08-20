/*
 * Web Push 전용 서비스워커. Turbopack에서 `next-pwa`를 쓸 수 없어 직접 작성했고,
 * 오프라인 프리캐시는 하지 않는다(푸시 수신 + 알림 클릭 라우팅만 담당).
 *
 * 여기서는 **access token을 절대 다루지 않는다** — 구독 등록/해제는 메인 스레드의
 * `src/lib/push.ts`가 Bearer 토큰을 붙여 처리한다. SW는 인증이 필요한 API를 호출하지 않는다.
 *
 * 백엔드(`app/services/push_service.py`)가 보내는 payload는 `{title, body, url, type}`
 * 4개 키로 고정이다. `type` 값 집합은 `src/lib/types.ts`의 `NotificationType`과 같다.
 */

/** 앱 스레드에 "알림이 하나 도착했다"고 알리는 메시지 타입 (`src/lib/push.ts`와 공유). */
const CLIENT_MESSAGE_TYPE = "notification";

const FALLBACK_TITLE = "NV 사이드 프로젝트";

self.addEventListener("install", () => {
  // 새 SW를 바로 활성화한다 — 캐시가 없으니 이전 버전과 공존할 이유가 없다.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // JSON이 아니면 본문을 그대로 본문 텍스트로 쓴다.
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || FALLBACK_TITLE;
  const url = payload.url || "/";
  const type = payload.type || null;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: payload.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        // 같은 종류의 알림이 쌓이면 최신 것만 남긴다(초대 3건이 트레이를 채우지 않게).
        tag: type || undefined,
        renotify: Boolean(type),
        data: { url, type },
      }),
      notifyClients(type),
    ]),
  );
});

/**
 * 앱이 열려 있는 동안에도 벨 뱃지가 즉시 갱신되도록 열린 탭에 알림 도착을 알린다.
 * 수신 측은 `NotificationBell`이며, 받으면 미읽음 수를 다시 조회한다.
 */
async function notifyClients(type) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: CLIENT_MESSAGE_TYPE, notificationType: type });
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(openAppAt(url));
});

/** 이미 열린 탭이 있으면 그 탭을 그 경로로 이동시키고, 없으면 새로 연다. */
async function openAppAt(url) {
  const target = new URL(url, self.location.origin);
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of clients) {
    if (new URL(client.url).origin !== target.origin) continue;
    await client.focus();
    // navigate()는 SW가 제어하는 클라이언트에서만 동작한다 — 실패하면 새 창으로 폴백.
    if (typeof client.navigate === "function") {
      try {
        await client.navigate(target.href);
        return;
      } catch {
        /* 아래 openWindow로 폴백 */
      }
    }
    return;
  }

  await self.clients.openWindow(target.href);
}
