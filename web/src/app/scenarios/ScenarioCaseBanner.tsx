import { findScenario, type ScenarioId } from './scenarios';
import { ScenarioExecutionMark } from './ScenarioProvenance';

export function ScenarioCaseBanner({ scenarioId }: { readonly scenarioId: ScenarioId }) {
  const scenario = findScenario(scenarioId);
  return (
    <section className="scenario-case-banner" aria-labelledby={`case-${scenario.id}`}>
      <header>
        <div><span>CASE STUDY</span><h2 id={`case-${scenario.id}`}>{scenario.caseStudy.title}</h2></div>
        <ScenarioExecutionMark compact scenarioId={scenarioId} />
      </header>
      <div>
        <CaseItem label="상황" value={scenario.caseStudy.situation} />
        <CaseItem label="위험" value={scenario.caseStudy.risk} tone="danger" />
        <CaseItem label="검증" value={scenario.caseStudy.verification} tone="success" />
      </div>
    </section>
  );
}

function CaseItem({ label, value, tone }: { readonly label: string; readonly value: string; readonly tone?: 'danger' | 'success' }) {
  return <article data-tone={tone}><span>{label}</span><p>{value}</p></article>;
}
