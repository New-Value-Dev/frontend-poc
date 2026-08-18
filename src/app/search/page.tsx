const scopes = ["내부통제", "개인정보보호", "사업본부", "R&D"];

const sources = [
  { name: "개인정보처리지침.hwpx", loc: "제14조", score: "94%" },
  { name: "8월 시각화팀.docx", loc: "개인정보 관련 안건", score: "88%" },
  { name: "운영매뉴얼.pdf", loc: "파기 절차", score: "81%" },
];

export default function RagSearchPage() {
  return (
    <div className="mx-auto grid h-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      {/* 검색 범위 */}
      <aside className="rounded-xl border border-border bg-canvas p-4">
        <h2 className="text-sm font-semibold text-ink">검색 범위</h2>
        <ul className="mt-3 flex flex-col gap-1">
          {scopes.map((s, i) => (
            <li key={s}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface">
                <input
                  type="checkbox"
                  defaultChecked={i === 0}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                {s}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-border pt-3 text-xs text-ink-muted">
          Hybrid: Vector + Full-text 검색
        </p>
      </aside>

      {/* 채팅 / 답변 영역 */}
      <section className="flex min-h-0 flex-col rounded-xl border border-border bg-canvas">
        <div className="flex-1 overflow-y-auto p-6">
          {/* 사용자 질문 */}
          <div className="flex justify-end">
            <div className="max-w-md rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-white">
              개인정보 파기 관련해서 지난 회의에서 어떤 얘기가 나왔어?
            </div>
          </div>

          {/* AI 답변 */}
          <div className="mt-5 flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
              AI
            </span>
            <div className="flex-1">
              <div className="rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3 text-sm leading-6 text-ink">
                개인정보 파기 관련 내용은 다음과 같습니다.
                <br />
                1. 보유 기간 경과 시 지체 없이 파기
                <br />
                2. 파기 이력 관리 및 별도 절차 적용
              </div>

              {/* 출처 */}
              <div className="mt-3">
                {/* `uppercase`는 "출처"(한글)에 아무 효과가 없고 넓은 자간만 헐렁하게 만들어 둘 다 제거. */}
                <p className="mb-2 text-xs font-semibold text-ink-muted">출처</p>
                <ul className="flex flex-col gap-2">
                  {sources.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium text-ink">{s.name}</span>
                        <span className="ml-2 text-xs text-ink-muted">{s.loc}</span>
                      </div>
                      <span className="text-xs font-medium text-primary">{s.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 입력창 */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <input
              type="text"
              placeholder="프로젝트 문서에 대해 질문하세요…"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
            />
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
            >
              전송
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
