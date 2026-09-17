import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ScenarioBadgeLegend } from './ScenarioBadgeLegend';
import { ScenarioAdminMark, ScenarioExecutionMark, ScenarioProvenanceMark } from './ScenarioProvenance';
import { findScenario, ORDERED_SCENARIOS, SCENARIO_GROUPS } from './scenarios';

/**
 * 목록만 맡는다. 상세는 전부 /scenarios/{id} 가 그린다.
 *
 * 전에는 카드를 누르면 이 페이지 안에서 상세가 열렸다. 그런데 그 상세의 버튼을 누르면
 * 또 다른 모양의 화면이 나와서, 같은 사례를 두 번 읽게 됐다. 주소로 가리킬 수도 없었다.
 * 카드는 이제 이동만 하고, 상태를 들 일이 없어져 클라이언트 컴포넌트도 아니다.
 */
export default function ScenariosPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <section className="scenario-hero">
          <div>
            <div className="eyebrow">Work cases &amp; operational rehearsals</div>
            <h1>실무에서 해결한 문제와 검증 과정을 보여준다</h1>
            <p>
              이커머스·상품권과 서비스 운영에서 마주친 문제를 익명화해 설명하고,
              재현 가능한 항목은 직접 실행해 상태 변화와 보완한 설계를 함께 기록합니다.
            </p>
          </div>
          <div className="scenario-summary">
            <strong>{ORDERED_SCENARIOS.length}</strong>
            <span>실무 사례와 운영 리허설</span>
          </div>
        </section>

        <ScenarioBadgeLegend />

        <section className="scenario-layout" aria-label="시나리오">
          <nav className="scenario-list" aria-label="시나리오 목록">
            {SCENARIO_GROUPS.map((group) => (
              <section className="scenario-group" key={group.id}>
                <header className="scenario-group-head">
                  <div>
                    <span>{group.label}</span>
                    <h2>{group.title}</h2>
                  </div>
                  <p>{group.description}</p>
                  {/* 단위가 없으면 오른쪽 끝에 뜬 숫자 하나라 무엇을 세는지 안 읽힌다. */}
                  <b>{group.scenarioIds.length}편</b>
                </header>
                <div className="scenario-group-grid">
                  {group.scenarioIds.map((scenarioId) => {
                    const scenario = findScenario(scenarioId);
                    const index = ORDERED_SCENARIOS.findIndex((item) => item.id === scenarioId);

                    return (
                      <Link href={`/scenarios/${scenario.id}`} key={scenario.id}>
                        {/* 상태는 헤더 오른쪽, 출처는 카드 하단.
                            둘을 나란히 두면 같은 크기의 라벨끼리 서로 경쟁한다. */}
                        <span className="scenario-card-kicker">
                          <b>{String(index + 1).padStart(2, '0')}</b>
                          <em>{scenario.eyebrow}</em>
                          <ScenarioExecutionMark compact scenarioId={scenarioId} />
                        </span>
                        <strong>{scenario.title}</strong>
                        {/* 카드는 summary, 상세 히어로는 proof 를 받는다. 같은 문장이 두 번 안 나온다.
                            summary 는 문제를 세우고 무엇을 보게 되는지까지 말해 세 줄을 채운다 —
                            길이는 scenarios.shape.test.ts 가 지킨다. 스물두 장이 같은 높이여야
                            목록이 훑린다. */}
                        <span className="scenario-card-summary">{scenario.summary}</span>
                        {/* 하단 줄. 출처는 왼쪽, 관리자 표시는 비어 있던 오른쪽 끝에 둔다. */}
                        <span className="scenario-card-footer">
                          <ScenarioProvenanceMark compact scenarioId={scenarioId} />
                          <ScenarioAdminMark scenarioId={scenarioId} />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </section>
      </main>
      <Footer />
    </>
  );
}
