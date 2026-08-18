import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 프론트엔드의 OAuth 착지점. 백엔드가 자체 /auth/callback에서 httpOnly refresh
 * 쿠키를 설정한 뒤 여기로 리다이렉트한다. 우리는 원래 목적지로 그대로 넘겨주기만
 * 하면 되고, 다음 렌더에서 AuthProvider가 쿠키로 세션을 초기화한다(refresh → me).
 *
 * `request.nextUrl.origin`은 쓰지 않는다 — `next dev`를 --hostname 없이 띄우면
 * 실제 Host 헤더와 무관하게 항상 localhost:PORT로 고정돼서, LAN/휴대폰으로 접속한
 * 요청도 리다이렉트가 localhost로 튀어버린다. 실제 Host 헤더를 직접 읽어 origin을
 * 만든다.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/";
  // 오픈 리다이렉트 방지를 위해 동일 origin의 상대 경로만 허용한다.
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const host = request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const origin = `${proto}://${host}`;

  return NextResponse.redirect(new URL(dest, origin));
}
