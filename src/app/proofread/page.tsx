"use client";

import { useRef, useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  PageHeader,
  ProofreadCategoryBadge,
} from "@/components/ui/primitives";
import { TextEditor, type TextEditorHandle } from "@/components/proofread/TextEditor";

type MockFinding = {
  id: string;
  original: string;
  suggestion: string;
  reason: string;
  category: string;
};

const MOCK_FINDINGS: MockFinding[] = [
  {
    id: "f0",
    original: "됬다",
    suggestion: "됐다",
    reason: "'되었다'의 준말은 '됬다'가 아니라 '됐다'로 적습니다.",
    category: "spelling",
  },
  {
    id: "f1",
    original: "몇일",
    suggestion: "며칠",
    reason: "'몇 일'은 잘못된 표기이며, '며칠'이 표준어입니다.",
    category: "spelling",
  },
  {
    id: "f2",
    original: "할수있다",
    suggestion: "할 수 있다",
    reason: "의존 명사 '수'는 앞말과 띄어 씁니다.",
    category: "spacing",
  },
  {
    id: "f3",
    original: "바래요",
    suggestion: "바라요",
    reason: "'바라다'의 활용형은 '바래요'가 아니라 '바라요'입니다.",
    category: "grammar",
  },
];

export default function ProofreadTextPage() {
  const editorRef = useRef<TextEditorHandle>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  function handleCheck() {
    setChecking(true);
    setChecked(false);
    window.setTimeout(() => {
      setChecking(false);
      setChecked(true);
    }, 700);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        title="맞춤법 검사기"
        description="문서로 등록하지 않고, 텍스트를 바로 입력해서 맞춤법과 띄어쓰기를 검사할 수 있어요."
      />

      <Card>
        <CardHeader>
          <CardTitle>텍스트 입력</CardTitle>
        </CardHeader>
        <div className="p-4">
          <TextEditor
            ref={editorRef}
            placeholder="검사할 텍스트를 입력하거나 붙여넣으세요."
            height="360px"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">
              지금은 미리보기 화면이라 실제 검사 대신 예시 결과를 보여드려요. 백엔드 연동 후 실제
              검사 결과로 바뀔 예정이에요.
            </p>
            <Button onClick={handleCheck} disabled={checking}>
              {checking ? "검사 중…" : "맞춤법 검사"}
            </Button>
          </div>
        </div>
      </Card>

      {checked && (
        <Card>
          <CardHeader>
            <CardTitle>검사 결과 (예시)</CardTitle>
            <span className="text-xs text-ink-muted">{MOCK_FINDINGS.length}건 발견</span>
          </CardHeader>
          <ul className="flex flex-col gap-2 p-4">
            {MOCK_FINDINGS.map((f) => (
              <li key={f.id} className="rounded-control border border-border p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <ProofreadCategoryBadge category={f.category} />
                </div>
                <p>
                  <span className="text-ink-muted line-through">{f.original}</span>
                  <span className="mx-1.5 text-ink-muted">→</span>
                  <span className="font-medium text-ink">{f.suggestion}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{f.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
