import type { ReactNode } from "react";
import Link from "next/link";
import type { DocStatus } from "@/lib/types";

export type { DocStatus };

export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/** 에러 배너. 인증 에러일 때만 로그인 링크를 표시한다. */
export function ErrorBanner({
  message,
  needLogin = false,
}: {
  message: string;
  needLogin?: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-panel border border-primary/30 bg-primary-soft p-4 text-sm text-primary"
    >
      {message}
      {needLogin && (
        <>
          {". 로그인이 필요합니다. "}
          <Link
            href="/login"
            className={`font-medium underline ${FOCUS_RING} rounded-sm`}
          >
            로그인
          </Link>
        </>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-panel border border-border bg-canvas ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-ink">{children}</h2>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-ink">{children}</h2>;
}

const INPUT_FOCUS = "outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

export type ButtonVariant = "primary" | "outline" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  outline: "border border-border bg-canvas text-ink hover:bg-surface",
  ghost: "text-ink-muted hover:bg-surface hover:text-ink",
};

export function buttonClass(variant: ButtonVariant = "primary", className = "") {
  return `inline-flex items-center gap-1.5 rounded-control px-3.5 py-2 text-sm font-medium transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ${FOCUS_RING} ${BUTTON_VARIANTS[variant]} ${className}`;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  onClick,
  disabled,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={buttonClass(variant, className)}
    >
      {children}
    </button>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass("outline", "w-fit")}>
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-control border border-border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted";

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_BASE} ${INPUT_FOCUS} ${className}`} />;
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_BASE} ${INPUT_FOCUS} ${className}`} />;
}

export function Select({
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_BASE} ${INPUT_FOCUS} ${className}`} />;
}

export type StatusTone = "idle" | "active" | "done" | "fail";

export const TONE_STYLES: Record<StatusTone, string> = {
  idle: "bg-surface-2 text-ink-muted",
  active: "bg-sky-50 text-sky-700",
  done: "bg-emerald-50 text-emerald-700",
  fail: "bg-primary-soft text-primary",
};

/* `DocStatus`는 백엔드 `processing_status`를 그대로 반영. */
const STATUS_STYLES: Record<DocStatus, { label: string; tone: StatusTone }> = {
  UPLOADED: { label: "업로드됨", tone: "idle" },
  PARSING: { label: "분석 중", tone: "active" },
  PARSED: { label: "분석 완료", tone: "active" },
  CHUNKING: { label: "청킹 중", tone: "active" },
  CHUNKED: { label: "청킹 완료", tone: "active" },
  EMBEDDING: { label: "임베딩 중", tone: "active" },
  READY: { label: "준비 완료", tone: "done" },
  FAILED: { label: "실패", tone: "fail" },
};

/** 처리 상태의 한글 라벨 — 호출부마다 맵을 다시 선언하지 않도록. */
export function statusLabel(status: DocStatus | string): string {
  return STATUS_STYLES[status as DocStatus]?.label ?? status;
}

export function statusTone(status: DocStatus | string): StatusTone {
  return STATUS_STYLES[status as DocStatus]?.tone ?? "idle";
}

export function StatusBadge({ status }: { status: DocStatus | string }) {
  // 백엔드가 알 수 없는/원시 상태 문자열을 보내도 허용한다.
  const known = STATUS_STYLES[status as DocStatus];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        TONE_STYLES[known?.tone ?? "idle"]
      }`}
    >
      {known?.label ?? status}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted">
      {children}
    </span>
  );
}
