/*
 * 대시보드용 경량 inline-SVG 차트 (의존성 없음). 크기/추세만 표현하므로
 * 카테고리 팔레트나 색약 검증 없이 브랜드 레드 단색으로 통일했다.
 * (2px 선, 둥근 막대 끝, 옅은 그리드, 네이티브 <title> 호버)
 */

import { TONE_STYLES, type StatusTone } from "@/components/ui/primitives";

const RED = "#b01c2e";

/* --- 통계 타일용 작은 스파크라인 --- */
export function Sparkline({ data }: { data: number[] }) {
  const W = 72;
  const H = 26;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = W / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / span) * (H - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={RED}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* --- 주간 처리 추이 (영역 + 선 + 점) --- */
export function AreaTrend({
  data,
  labels,
}: {
  data: number[];
  labels: string[];
}) {
  const W = 660;
  const H = 240;
  const padX = 20;
  const padTop = 18;
  const padBottom = 34;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const max = Math.max(...data) * 1.2 || 1;
  const step = innerW / (data.length - 1);

  const pts = data.map((v, i) => ({
    x: padX + i * step,
    y: padTop + innerH * (1 - v / max),
    v,
  }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const baseY = padTop + innerH;
  const area = `${line} L${(padX + innerW).toFixed(1)} ${baseY} L${padX} ${baseY} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1];

  return (
    /* 포인트별 `<title>`은 호버 정보만 줄 뿐, 차트 자체에 라벨이 없으면
       스크린리더가 의미 없는 숫자 여덟 개만 읽어주므로 aria-label로 보강. */
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`최근 ${data.length}일 문서 처리량 추이. ${labels
        .map((l, i) => `${l} ${data[i]}건`)
        .join(", ")}.`}
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RED} stopOpacity="0.22" />
          <stop offset="100%" stopColor={RED} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 옅은 그리드라인 */}
      {grid.map((t) => (
        <line
          key={t}
          x1={padX}
          x2={padX + innerW}
          y1={padTop + innerH * t}
          y2={padTop + innerH * t}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
      ))}

      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={RED} strokeWidth="2" />
          <title>{`${labels[i]}: ${p.v}건`}</title>
        </g>
      ))}

      {/* x축 라벨 */}
      {pts.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={H - 12}
          textAnchor="middle"
          className="fill-[var(--color-ink-muted)]"
          fontSize="11"
        >
          {labels[i]}
        </text>
      ))}
    </svg>
  );
}

/* --- 가로 막대 그래프 (단일 색상) --- */
export function BarList({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-3 text-sm">
          <span className="w-16 shrink-0 truncate text-ink-muted" title={it.label}>
            {it.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((it.value / max) * 100, 6)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-mono font-medium text-ink">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}

/* --- 처리 파이프라인 스트립 --- */
export function PipelineStrip({
  stages,
}: {
  stages: { label: string; count: number; tone: StatusTone }[];
}) {
  return (
    /*
     * 분리된 블록이 아니라 하나로 이어진 트랙. 세그먼트가 너비를 나눠 가지므로
     * 맞닿은 셀 자체가 순서를 표현해 화살표 커넥터가 필요 없고, `min-w`로 각
     * 세그먼트의 가독성을 유지하면서 좁은 화면에서는 스크롤되게 한다.
     */
    <div className="relative overflow-hidden rounded-panel border border-border">
      <ol className="flex overflow-x-auto">
        {stages.map((s, i) => (
          <li
            key={s.label}
            /*
             * 빈 세그먼트는 채색하지 않는다. 대부분 비어 있는 단계까지 tone을
             * 입히면 대비가 AA 턱걸이(4.60:1)가 되지만, 무채색이면 5.28:1로
             * 더 잘 읽히고 색은 실제 문서가 있는 곳에만 나타나 의미도 분명해진다.
             */
            className={`min-w-[88px] flex-1 px-2 py-2.5 text-center ${
              i > 0 ? "border-l border-border" : ""
            } ${s.tone === "idle" ? "text-ink-muted" : TONE_STYLES[s.tone]}`}
          >
            <p className="font-mono text-lg font-semibold leading-none">{s.count}</p>
            <p className="mt-1 text-xs">{s.label}</p>
          </li>
        ))}
      </ol>
      {/* 좁은 화면에서 세그먼트가 넘칠 때 스크롤 가능함을 알리는 페이드 힌트 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent lg:hidden"
      />
    </div>
  );
}
