"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "@/lib/push";
import { Button, Card, CardHeader, CardTitle, ErrorBanner } from "@/components/ui/primitives";

/** 상태별 안내 문구 — 지원 여부/권한/구독 여부를 한 줄로 설명한다. */
const HINTS: Record<PushState, string> = {
  unsupported: "이 브라우저는 웹 푸시를 지원하지 않습니다. 알림은 상단 벨에서 확인할 수 있습니다.",
  insecure:
    "푸시는 HTTPS 또는 localhost에서만 설정할 수 있습니다. LAN IP로 접속한 경우에는 켤 수 없습니다.",
  denied:
    "브라우저에서 이 사이트의 알림을 차단했습니다. 사이트 설정에서 알림을 허용한 뒤 다시 시도해 주세요.",
  subscribed: "초대·분석 완료 알림을 이 기기의 시스템 알림으로 받습니다.",
  unsubscribed:
    "켜면 초대·분석 완료 알림을 이 기기의 시스템 알림으로 받습니다. 끄더라도 상단 벨에는 계속 쌓입니다.",
};

/**
 * 기기별 Web Push 구독 토글. 구독은 브라우저+기기 단위라 다른 기기에서 켠 것과 무관하게
 * 이 기기에서 따로 켜야 한다. 미지원/비보안 컨텍스트에서는 버튼 대신 이유만 보여준다.
 */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPushState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (state === "subscribed") await unsubscribeFromPush();
      else await subscribeToPush();
      setState(await getPushState());
    } catch (e) {
      setError(errorMessage(e, "푸시 알림 설정에 실패했습니다."));
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  }

  const canToggle = state === "subscribed" || state === "unsubscribed";

  return (
    <Card>
      <CardHeader>
        <CardTitle>푸시 알림</CardTitle>
        {state === "subscribed" && <span className="text-xs text-ink-muted">이 기기에서 켜짐</span>}
      </CardHeader>
      <div className="flex flex-col gap-4 px-5 py-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          {state ? HINTS[state] : "설정을 확인하는 중…"}
        </p>
        {canToggle && (
          <div className="flex justify-end">
            <Button
              variant={state === "subscribed" ? "outline" : "dark"}
              onClick={toggle}
              disabled={busy}
            >
              {busy ? "처리 중…" : state === "subscribed" ? "푸시 끄기" : "푸시 켜기"}
            </Button>
          </div>
        )}
        {error && <ErrorBanner message={error} />}
      </div>
    </Card>
  );
}
