import { PageHeader, Card, CardHeader, CardTitle, Button } from "@/components/ui/primitives";

const sampleQuestions = [
  {
    q: "개인정보를 파기해야 하는 시점은 언제인가?",
    choices: ["보유 기간 경과 시 지체 없이", "요청이 있을 때만", "연 1회 정기적으로", "파기하지 않음"],
    answer: 0,
  },
  {
    q: "내부통제 지침상 문서 승인 권한은 누구에게 있는가?",
    choices: ["작성자 본인", "팀장 이상 승인권자", "전체 팀원 합의", "IT팀"],
    answer: 1,
  },
];

export default function QuizPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="퀴즈"
        description="RAG Retrieval Engine으로 프로젝트 문서에서 문제를 자동 생성합니다. 백엔드 API가 아직 없어 화면 구성만 보여주는 목업입니다."
        actions={<Button disabled>퀴즈 생성</Button>}
      />

      <Card className="p-5">
        <p className="text-sm leading-6 text-ink-muted">
          퀴즈 기능은 RAG 검색이 먼저 배선된 뒤 <code className="text-ink">/quizzes/*</code> 엔드포인트가
          확정되면 연결됩니다. 지금은 예시 문항으로 화면 구조만 확인할 수 있습니다.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>예시 문항</CardTitle>
          <span className="text-xs text-ink-muted">2 / 2</span>
        </CardHeader>
        <div className="flex flex-col divide-y divide-border">
          {sampleQuestions.map((item, i) => (
            <div key={i} className="p-5">
              <p className="text-sm font-medium text-ink">
                {i + 1}. {item.q}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {item.choices.map((c, ci) => (
                  <li
                    key={ci}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      ci === item.answer
                        ? "border-primary/40 bg-primary-soft text-primary"
                        : "border-border text-ink-muted"
                    }`}
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
