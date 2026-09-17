import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('./wiki-content.css', import.meta.url), 'utf8');

describe('orchestration map responsive contract', () => {
  it('keeps the single-row flow at the constrained desktop content width', () => {
    // Given: the map lives in the site's 1264px-wide content container.
    // When: its responsive CSS is evaluated at desktop width.
    // Then: the cluster keeps enough space and the stacked layout starts below desktop.
    expect(stylesheet).toContain('minmax(720px, 2.5fr)');
    // 가운데 칸은 좁게 잡는다. k3s 상자가 화면에서 제일 크면 정보가 제일 적은 것이 제일 커진다.
    expect(stylesheet).toContain('minmax(0, 1fr) 62px minmax(112px, .5fr) 62px minmax(0, 1fr)');
    // 관측은 아래 가로 띠다. 두 행을 걸치는 칸이 없어야 내용이 짧아져도 구멍이 안 난다.
    expect(stylesheet).toContain('.zone-observability { grid-column: 1 / -1; grid-row: 3;');
    expect(stylesheet).toContain('max-width: 1222px');
    expect(stylesheet).toContain('margin: 16px auto 0');
    expect(stylesheet).toContain('@container (min-width: 901px) and (max-width: 1120px)');
    expect(stylesheet).toContain('140px 28px minmax(530px, 1fr) 28px 140px');
    expect(stylesheet).toContain('@container (max-width: 900px)');
  });
});
