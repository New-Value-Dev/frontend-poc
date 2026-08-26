"use client";

/* 임시 프리뷰 — 필터바/드롭다운 레이아웃 확인용. 확인 후 삭제한다. */

import { useEffect, useState } from "react";
import { Card, PageHeader, buttonClass } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { FilterBar } from "@/components/ui/FilterBar";

const LONG_DOCS = [
  { value: "all", label: "전체 문서" },
  { value: "1", label: "2026년 개인정보보호 내부관리계획 개정안 (최종본 v3).docx", hint: "테스트 프로젝트" },
  { value: "2", label: "어린이 기사", hint: "테스트 프로젝트" },
  { value: "3", label: "정보통신망 이용촉진 및 정보보호 등에 관한 법률 시행령 별표 3.pdf", hint: "다른 프로젝트" },
];

export default function PreviewPage() {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [doc, setDoc] = useState("3");
  const [difficulty, setDifficulty] = useState("all");
  const [type, setType] = useState("all");
  const [review, setReview] = useState("all");

  // 헤드리스 스크린샷용 — 패널이 열린 상태를 찍기 위해 자동으로 트리거를 누른다.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("open")) return;
    const timer = setTimeout(() => {
      document
        .querySelectorAll<HTMLButtonElement>('button[aria-label="출처 문서"]')
        [Number(new URLSearchParams(location.search).get("open"))]?.click();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 bg-surface p-8">
      <PageHeader
        title="문제집"
        description="문제은행에서 문항을 골라 구성하는 응시 단위입니다."
        actions={<span className={buttonClass("primary")}>+ 문제집 만들기</span>}
      />

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: "문제집 이름 검색…" }}
        trailing="1개 문제집"
        activeCount={(query ? 1 : 0) + (project ? 1 : 0)}
        onReset={() => {
          setQuery("");
          setProject("");
        }}
      >
        <Dropdown
          variant="chip"
          label="프로젝트"
          value={project}
          onChange={setProject}
          options={[
            { value: "", label: "전체 프로젝트" },
            { value: "1", label: "테스트 프로젝트" },
            { value: "2", label: "개인정보보호 교육 자료 모음 프로젝트" },
          ]}
        />
      </FilterBar>

      <PageHeader title="문제은행" description="여러 문제집이 함께 쓰는 문항 저장소입니다." />

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: "문제 본문 검색…" }}
        trailing="24개 문제"
        activeCount={[doc, difficulty, type, review].filter((v) => v !== "all").length}
        onReset={() => {
          setDoc("all");
          setDifficulty("all");
          setType("all");
          setReview("all");
        }}
      >
        <Dropdown
          variant="chip"
          label="프로젝트"
          value={project}
          onChange={setProject}
          options={[
            { value: "", label: "전체 프로젝트" },
            { value: "1", label: "테스트 프로젝트" },
          ]}
        />
        <Dropdown
          variant="chip"
          label="출처 문서"
          value={doc}
          onChange={setDoc}
          options={LONG_DOCS}
          searchable
        />
        <Dropdown
          variant="chip"
          label="난이도"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: "all", label: "전체 난이도" },
            { value: "EASY", label: "쉬움" },
            { value: "MEDIUM", label: "보통" },
          ]}
        />
        <Dropdown
          variant="chip"
          label="유형"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "전체 유형" },
            { value: "SINGLE_CHOICE", label: "객관식" },
          ]}
        />
        <Dropdown
          variant="chip"
          label="검수 상태"
          value={review}
          onChange={setReview}
          options={[
            { value: "all", label: "전체 검수 상태" },
            { value: "DRAFT", label: "검수 전" },
          ]}
        />
      </FilterBar>

      <Card className="p-5">
        <div className="w-full sm:w-80">
          <p className="mb-1.5 text-xs font-medium text-ink">출처 문서 (field 변형)</p>
          <Dropdown label="출처 문서" value={doc} onChange={setDoc} options={LONG_DOCS} />
        </div>
      </Card>
    </div>
  );
}
