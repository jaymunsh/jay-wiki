import {
  findScenarioExecution,
  findScenarioProvenance,
  isAdminOnlyScenario,
  type ScenarioId,
} from './scenarios';

type MarkProps = {
  readonly scenarioId: ScenarioId;
  readonly compact?: boolean;
};

/** 출처 — 이 문제를 어디서 가져왔나. 분류라서 조용한 라벨로 둔다. */
export function ScenarioProvenanceMark({ scenarioId, compact = false }: MarkProps) {
  const provenance = findScenarioProvenance(scenarioId);

  return (
    <div className="scenario-provenance" data-kind={provenance.kind} data-compact={compact || undefined} title={compact ? provenance.description : undefined}>
      <span>{provenance.label}</span>
      {!compact && <p>{provenance.description}</p>}
    </div>
  );
}

/** 실행 — 화면의 단계와 숫자가 실측인가. 분류가 아니라 상태라서 상태등 형태로 둔다. */
export function ScenarioExecutionMark({ scenarioId, compact = false }: MarkProps) {
  const execution = findScenarioExecution(scenarioId);

  return (
    <div className="scenario-provenance scenario-execution" data-execution={execution.kind} data-compact={compact || undefined} title={compact ? execution.description : undefined}>
      <span>{execution.label}</span>
      {!compact && <p>{execution.description}</p>}
    </div>
  );
}

/**
 * 실행이 관리자로 닫힌 편에만 붙는다. 화면 중간의 실행 패널까지 내려가야 알 수 있던 것을
 * 목록과 히어로에서 미리 알린다. 관리자가 아닌 사람에게도 무엇을 하는 편인지는 그대로 보인다.
 */
export function ScenarioAdminMark({ scenarioId }: { readonly scenarioId: ScenarioId }) {
  if (!isAdminOnlyScenario(scenarioId)) return null;

  return (
    <span className="scenario-admin-mark" title="실행은 관리자만 할 수 있습니다. 무엇을 하는 편인지는 로그인 없이 볼 수 있습니다.">
      ADMIN ONLY
    </span>
  );
}

/**
 * 둘을 세로로 쌓은 형태. 설명까지 보여줄 지면이 있는 상세 패널과 데모 화면에서 쓴다.
 * 목록 카드에서는 두 배지를 나란히 두면 서로 경쟁하므로, 상태는 헤더 오른쪽에 두고
 * 출처만 카드 하단에 남긴다. 그쪽은 각 Mark 를 따로 배치한다.
 */
export function ScenarioProvenance({ scenarioId, compact = false }: MarkProps) {
  return (
    <div className="scenario-provenance-group" data-compact={compact || undefined}>
      <ScenarioProvenanceMark compact={compact} scenarioId={scenarioId} />
      <ScenarioExecutionMark compact={compact} scenarioId={scenarioId} />
      {/* 오른쪽 끝으로 민다. 히어로는 오른쪽이 비어 있어 배지 둘과 경쟁하지 않는다. */}
      <ScenarioAdminMark scenarioId={scenarioId} />
    </div>
  );
}
