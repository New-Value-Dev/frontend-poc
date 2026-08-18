"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, Field, Input } from "./primitives";

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "max-w-sm",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`relative w-full rounded-panel border border-border bg-canvas p-5 shadow-xl ${className}`}
      >
        {title && (
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
        )}
        <div className={title ? "mt-4" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title = "삭제하시겠어요?",
  message,
  confirmLabel = "삭제",
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button onClick={onConfirm} disabled={busy}>
          {busy ? "처리 중…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function PromptDialog({
  open,
  title,
  label,
  fieldLabel = "이름",
  placeholder,
  initialValue = "",
  submitLabel = "생성",
  onSubmit,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  label?: string;
  fieldLabel?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const fieldId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setValue(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (v) onSubmit(v);
  }

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <form onSubmit={submit}>
        <Field label={fieldLabel} htmlFor={fieldId} hint={label}>
          <Input
            id={fieldId}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" disabled={busy || !value.trim()}>
            {busy ? "처리 중…" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
