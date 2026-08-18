import { PageHeader, Card, CardHeader, CardTitle, Button } from "@/components/ui/primitives";
import { BarList } from "@/components/charts";

const models: {
  key: string;
  name: string;
  status: "ACTIVE" | "TESTED" | "TEST";
  recall: string;
  latency: string;
  ram: string;
}[] = [
  { key: "kure-v1", name: "KURE-v1", status: "ACTIVE", recall: "0.94", latency: "130ms", ram: "3.1GB" },
  { key: "bge-m3", name: "BGE-M3", status: "TESTED", recall: "0.91", latency: "120ms", ram: "2.8GB" },
  { key: "qwen3", name: "Qwen3-Embedding-0.6B", status: "TESTED", recall: "0.93", latency: "95ms", ram: "1.9GB" },
];

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  TESTED: "bg-sky-50 text-sky-700",
  TEST: "bg-surface-2 text-ink-muted",
};

export default function EmbeddingLabPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Embedding Lab"
        description="실제 프로젝트 문서 기반 벤치마크로 임베딩 모델을 비교하고 활성 모델을 선정합니다."
        actions={
          <>
            <Button variant="outline">Dataset 선택</Button>
            <Button>Benchmark 실행</Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Embedding Models</CardTitle>
          <span className="text-xs text-ink-muted">dimension 1024 · 동일 조건 비교</span>
        </CardHeader>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-muted">
              <th className="px-5 py-3 font-medium">Model</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Recall@5</th>
              <th className="px-5 py-3 font-medium">Latency</th>
              <th className="px-5 py-3 font-medium">RAM</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {models.map((m) => (
              <tr key={m.key} className="hover:bg-surface">
                <td className="px-5 py-3 font-medium text-ink">{m.name}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[m.status]}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-ink">{m.recall}</td>
                <td className="px-5 py-3 text-ink-muted">{m.latency}</td>
                <td className="px-5 py-3 text-ink-muted">{m.ram}</td>
                <td className="px-5 py-3 text-right">
                  {m.status === "ACTIVE" ? (
                    <span className="text-xs text-ink-muted">활성</span>
                  ) : (
                    <button type="button" className="text-xs font-medium text-primary hover:underline">
                      활성화
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      {/* 종합 점수 + 선정 결과 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>종합 점수</CardTitle>
            <span className="text-xs text-ink-muted">가중치 반영 · 100점 만점</span>
          </CardHeader>
          <div className="p-5">
            <BarList
              items={[
                { label: "KURE-v1", value: 92 },
                { label: "Qwen3", value: 88 },
                { label: "BGE-M3", value: 85 },
              ]}
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              선정 완료
            </span>
            <span className="text-sm font-semibold text-ink">KURE-v1</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            사내 문서 대부분이 한국어라 한국어 검색 정확도(Recall@5 0.94)가 가장 높은{" "}
            <span className="font-medium text-ink">KURE-v1</span>을 활성 모델로 선정했습니다.
            기존 임베딩은 즉시 삭제하지 않아 롤백이 가능합니다.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-xs">
            <li className="flex justify-between"><span className="text-ink-muted">검색 정확도 (60%)</span><span className="font-medium text-ink">0.94 · 최상</span></li>
            <li className="flex justify-between"><span className="text-ink-muted">Query Latency (10%)</span><span className="font-medium text-ink">130ms · 보통</span></li>
            <li className="flex justify-between"><span className="text-ink-muted">RAM/VRAM (10%)</span><span className="font-medium text-ink">3.1GB · 보통</span></li>
          </ul>
        </Card>
      </div>

      <p className="text-xs text-ink-muted">
        모델 선정 기준: 검색 정확도 60% · 임베딩 성능 15% · Query Latency 10% · RAM/VRAM 10% · 운영 편의성 5%
      </p>
    </div>
  );
}
