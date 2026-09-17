import { describe, expect, it } from 'vitest';
import { isAdminOnlyScenario, ORDERED_SCENARIOS, SCENARIO_GROUPS } from './scenarios';

/**
 * 화면 뼈대가 글감 개수를 전제로 한다. 개수가 어긋나도 타입은 통과하고
 * 브라우저에서만 빈 칸으로 보이므로, 여기서 센다. vitest 는 node 환경이라
 * 그릴 수는 없지만 셀 수는 있다.
 */
describe('시나리오 글감 형태', () => {
  // 판단 개수는 세지 않는다. 한때 "정확히 여섯"으로 고정했다가 문장을 합치는 과정에서
  // 사실이 잘려 나갔다. 남는 칸은 CSS 의 span 규칙이 처리하므로 글은 자유다.

  it('모든 편이 정확히 한 그룹에 속한다', () => {
    const grouped = SCENARIO_GROUPS.flatMap((g) => g.scenarioIds);
    expect(grouped.length).toBe(ORDERED_SCENARIOS.length);
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('신호는 사람 말 라벨을 갖는다', () => {
    const bare = ORDERED_SCENARIOS.flatMap((s) =>
      s.signals.filter((sig) => !sig.label.trim()).map(() => s.id),
    );
    expect(bare).toEqual([]);
  });

  // 카드는 415px(3열) 폭이라 한 줄에 34자쯤 든다. 세 줄에 맞추려면 이 범위여야 하고,
  // 한 편이라도 벗어나면 그 줄의 카드가 통째로 높아지거나 아래에 빈 공간이 남는다.
  // 카드 스물세 장이 같은 높이인 것이 목록을 훑게 하는 조건이다.
  it('summary 는 카드 세 줄에 든다 (90~108자)', () => {
    const off = ORDERED_SCENARIOS.filter((s) => s.summary.length < 90 || s.summary.length > 108).map(
      (s) => `${s.id}=${s.summary.length}`,
    );
    expect(off).toEqual([]);
  });

  // 관리자 표시는 실재하는 편에만 붙어야 한다. id 를 잘못 적으면 배지가 조용히 안 뜨고,
  // 그 편은 눌러도 안 되는 실행 버튼을 그대로 보여 준다 — 화면 테스트로는 안 잡힌다.
  it('관리자 전용 표시는 실재하는 편에만 붙는다', () => {
    const marked = ORDERED_SCENARIOS.filter((s) => isAdminOnlyScenario(s.id)).map((s) => s.id);
    expect(marked).toEqual(['hpa-scaleout', 'alert-chain-drill', 'bulk-spreadsheet-operations']);
  });
});
