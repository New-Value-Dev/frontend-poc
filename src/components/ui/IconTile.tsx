"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FOCUS_RING } from "./primitives";

type TileBodyProps = {
  icon: ReactNode;
  label: string;
  sublabel?: ReactNode;
};

function TileShell({ children, menu }: { children: ReactNode; menu?: ReactNode }) {
  return (
    <div className="group relative flex flex-col items-center gap-1.5 rounded-panel border border-transparent p-3 text-center transition-colors hover:border-border hover:bg-surface focus-within:border-border focus-within:bg-surface">
      {children}
      {menu && (
        <div className="absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {menu}
        </div>
      )}
    </div>
  );
}

function TileBody({ icon, label, sublabel }: TileBodyProps) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1.5">
      {icon}
      <span className="line-clamp-2 max-w-full break-all text-xs font-medium leading-snug text-ink">
        {label}
      </span>
      {sublabel}
    </div>
  );
}

/** 실제 URL로 이동하는 타일 (문서, 프로젝트). */
export function LinkIconTile({
  href,
  icon,
  label,
  sublabel,
  menu,
}: TileBodyProps & { href: string; menu?: ReactNode }) {
  return (
    <TileShell menu={menu}>
      <Link
        href={href}
        aria-label={label}
        className={`absolute inset-0 z-0 rounded-panel ${FOCUS_RING}`}
      />
      <TileBody icon={icon} label={label} sublabel={sublabel} />
    </TileShell>
  );
}

/** 클라이언트 상태만 바꾸는 타일 (폴더 드릴다운). */
export function ButtonIconTile({
  onOpen,
  icon,
  label,
  sublabel,
  menu,
}: TileBodyProps & { onOpen: () => void; menu?: ReactNode }) {
  return (
    <TileShell menu={menu}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className={`absolute inset-0 z-0 rounded-panel ${FOCUS_RING}`}
      />
      <TileBody icon={icon} label={label} sublabel={sublabel} />
    </TileShell>
  );
}
