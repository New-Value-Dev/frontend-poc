import Link from "next/link";
import type { ActivityItem } from "@/lib/types";
import { initialsOf } from "@/lib/auth";
import { FOCUS_RING } from "@/components/ui/primitives";

/**
 * 백엔드가 내려주는 활동 종류는 13가지라 4가지 tone으로 묶는다. 배지 텍스트가 이미
 * kind 이름을 담고 있으므로 색은 개별 식별이 아니라 분류만 나타내면 된다. `analysis`에
 * 처음엔 amber를 썼지만 브랜드 레드와 ΔE 10.6으로 정상 시야 기준(15) 미만이라
 * `destructive`와 함께 쓰지 않도록 뺐다.
 *
 * activity kind는 파이프라인 단계가 아니라 행동 분류이므로 `statusTone`과
 * 별도의 맵으로 유지한다.
 */
const TONE = {
  destructive: "bg-primary-soft text-primary",
  analysis: "bg-violet-50 text-violet-700",
  change: "bg-sky-50 text-sky-700",
  quiet: "bg-surface-2 text-ink-muted",
} as const;

const KIND_TONE: Record<string, keyof typeof TONE> = {
  삭제: "destructive",
  오타: "analysis",
  규정: "analysis",
  분류: "analysis",
  추천: "analysis",
  분석: "analysis",
  업로드: "change",
  버전: "change",
  프로젝트: "change",
  폴더: "change",
  문서: "change",
  로그인: "quiet",
  기타: "quiet",
};

/**
 * 두 조건 모두 필수: id는 테이블별로 매겨지므로 `project` 타입 행의 `targetId`가
 * 무관한 *document*를 열어버릴 수 있고(엉뚱한 파일을 조용히 200으로 열람), 로그는
 * 대상보다 오래 남으므로 `targetAlive`로 삭제된 대상을 걸러낸다.
 * `kind`는 표시용 문구일 뿐이라 조용히 깨질 수 있어 의도적으로 검사하지 않는다.
 */
function canLinkToDocument(a: ActivityItem): a is ActivityItem & { targetId: number } {
  return a.targetType === "document" && a.targetId != null && a.targetAlive;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

/** 대시보드/마이페이지가 공유하는 활동 목록 렌더링. 목록이 비어 있을 때 표시할 내용은 호출부 책임. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((a, i) => (
        <li key={`${a.at}-${i}`} className="flex items-start gap-3 px-5 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
            {initialsOf({ name: a.actor, email: a.actor })}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              <span className="font-medium">{a.actor}</span>
              <span className="text-ink-muted"> · {a.action}</span>
            </p>
            {/* `로그인`처럼 대상이 없는 활동은 `target`이 빈 문자열이다. */}
            {a.target &&
              (canLinkToDocument(a) ? (
                <Link
                  href={`/documents/${a.targetId}`}
                  className={`block truncate rounded-sm text-xs text-ink-muted transition-colors hover:text-primary hover:underline ${FOCUS_RING}`}
                >
                  {a.target}
                </Link>
              ) : (
                <p className="truncate text-xs text-ink-muted">{a.target}</p>
              ))}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                TONE[KIND_TONE[a.kind] ?? "quiet"]
              }`}
            >
              {a.kind}
            </span>
            <span className="text-xs text-ink-muted">{relativeTime(a.at)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
