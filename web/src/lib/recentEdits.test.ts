import { describe, expect, it } from 'vitest';
import { isEdited } from './recentEdits';

describe('isEdited', () => {
  it('발행 직후(두 값이 같음)는 수정이 아니다', () => {
    expect(isEdited({ createdAt: '2026-08-13T10:26:00Z', updatedAt: '2026-08-13T10:26:00Z' })).toBe(false);
  });

  it('같은 날 고친 글도 수정이다', () => {
    // 19:34 발행 → 21:19 수정. 문턱이 24시간이던 때 이 글이 목록에서 빠졌다.
    expect(isEdited({ createdAt: '2026-08-13T10:34:00Z', updatedAt: '2026-08-13T12:19:00Z' })).toBe(true);
  });

  it('값이 없거나 깨졌으면 넣지 않는다', () => {
    expect(isEdited({ createdAt: '2026-08-13T10:34:00Z' })).toBe(false);
    expect(isEdited({ createdAt: 'x', updatedAt: 'y' })).toBe(false);
  });
});
