"use client";

import { useMemo } from "react";
import { diffText } from "@/lib/textDiff";
import { DiffView } from "@/components/document/DiffModal";
import { Modal } from "@/components/ui/Modal";

export function TextDiffModal({
  open,
  onClose,
  original,
  corrected,
}: {
  open: boolean;
  onClose: () => void;
  original: string;
  corrected: string;
}) {
  const result = useMemo(() => diffText(original, corrected), [original, corrected]);

  return (
    <Modal open={open} onClose={onClose} title="원본과 비교" className="max-w-5xl">
      <DiffView result={result} fromLabel="원본" toLabel="승인한 교정 적용" />
    </Modal>
  );
}
