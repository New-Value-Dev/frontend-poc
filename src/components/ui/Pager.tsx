"use client";

import { Button } from "./primitives";

/** 페이지 번호 기반의 단순 이전/다음 페이저 */
export function Pager({
  page,
  size,
  total,
  onChange,
}: {
  page: number;
  size: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-ink-muted">
      <span>총 {total.toLocaleString("ko-KR")}건</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          이전
        </Button>
        <span className="tnum">
          {page} / {totalPages}
        </span>
        <Button variant="outline" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          다음
        </Button>
      </div>
    </div>
  );
}
