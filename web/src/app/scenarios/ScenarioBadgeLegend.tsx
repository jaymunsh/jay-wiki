import { SCENARIO_EXECUTION, SCENARIO_PROVENANCE } from './scenarios';

/**
 * 카드에 붙는 배지는 공간이 좁아 라벨만 보여준다. 그래서 목록 상단에 한 번 뜻을 밝힌다.
 *
 * 축이 둘이라는 것 자체가 설명돼야 한다. 출처는 "이 문제를 어디서 가져왔나"이고
 * 실행은 "화면 숫자가 실측인가"인데, 하나로 읽으면 출처가 곧 실행이라고 오해하게 된다.
 * 배지 라벨을 네 글자로 줄인 것도 여기에 기대는 결정이다 — 뜻은 범례가 진다.
 */
export function ScenarioBadgeLegend() {
  const provenance = uniqueBy(Object.values(SCENARIO_PROVENANCE), (item) => item.kind);
  const execution = uniqueBy(Object.values(SCENARIO_EXECUTION), (item) => item.kind);

  return (
    <section className="scenario-legend" aria-label="배지 읽는 법">
      <header>
        <span>배지 읽는 법</span>
        <p>카드마다 배지가 두 개 붙습니다. 왼쪽은 문제의 출처, 오른쪽은 화면이 실제로 실행되는지입니다.</p>
      </header>
      <div>
        <article>
          <h2>출처 — 이 문제를 어디서 가져왔나</h2>
          <dl>
            {provenance.map((item) => (
              <div key={item.kind}>
                <dt className="scenario-legend-chip" data-kind={item.kind}>{item.label}</dt>
                <dd>{shorten(item.description)}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article>
          <h2>실행 — 화면의 단계와 숫자가 실측인가</h2>
          <dl>
            {execution.map((item) => (
              <div key={item.kind}>
                <dt className="scenario-legend-chip" data-execution={item.kind}>{item.label}</dt>
                <dd>{shorten(item.description)}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}

/** 배지 설명은 상세 화면용이라 길다. 범례에서는 첫 문장만 쓴다. */
function shorten(description: string): string {
  const [first] = description.split('. ');
  return first.endsWith('.') ? first : `${first}.`;
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  items.forEach((item) => {
    if (!seen.has(key(item))) seen.set(key(item), item);
  });
  return [...seen.values()];
}
