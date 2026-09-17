import type { ScenarioFlow } from './scenarios';

export function ScenarioFlowDiagram({ flow }: { readonly flow: ScenarioFlow }) {
  return (
    <section className="scenario-flow" aria-label={flow.label}>
      <div className="scenario-flow-head">
        <span>FLOW MAP</span>
        <strong>{flow.label}</strong>
      </div>
      <div className="scenario-flow-track">
        {flow.steps.map((step, index) => (
          <div className="scenario-flow-item" data-tone={step.tone} key={step.label}>
            {index > 0 && <span className="scenario-flow-connector" aria-hidden="true">→</span>}
            <div>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
