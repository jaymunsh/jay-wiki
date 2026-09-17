import { notFound } from 'next/navigation';
import { ORDERED_SCENARIOS, SCENARIOS } from '../scenarios';
import { ScenarioDetail } from '../ScenarioDetail';

type ScenarioDetailPageProps = { readonly params: Promise<{ readonly id: string }> };

export function generateStaticParams() {
  return ORDERED_SCENARIOS.map((scenario) => ({ id: scenario.id }));
}

/**
 * 시나리오 하나에 주소 하나. 스물두 편이 전부 같은 화면(ScenarioDetail)을 쓴다.
 * 실행판이 붙는 편도 여기로 오고, 실행이 다른 화면에 있는 편은 이 화면에서 그리로 보낸다.
 */
export default async function ScenarioDetailPage({ params }: ScenarioDetailPageProps) {
  const { id } = await params;
  const scenario = SCENARIOS.find((item) => item.id === id);
  if (!scenario) notFound();
  return <ScenarioDetail scenario={scenario} />;
}
