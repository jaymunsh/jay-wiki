import { describe, expect, it } from 'vitest';

import { formatIpPrefix, formatTags, parseTags, toDateTimeLocalValue, toOffsetDateTime, toPostId } from './blogAdminForm';

describe('toDateTimeLocalValue', () => {
  it('입력칸 형식으로 줄인다', () => {
    expect(toDateTimeLocalValue('2026-08-11T16:45:30.476903Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('저장과 왕복해도 가리키는 시각이 그대로다 — 손대지 않고 저장만 눌러도 밀리면 안 된다', () => {
    const stored = '2026-08-11T16:45:30.476903Z';
    const shown = toDateTimeLocalValue(stored);
    const saved = toOffsetDateTime(shown) as string;
    // 입력칸이 분 단위라 초는 잘린다. 그 아래로는 어긋나지 않아야 한다.
    expect(new Date(saved).getTime()).toBe(Math.floor(new Date(stored).getTime() / 60000) * 60000);
  });

  it('UTC 문자열을 그대로 자르지 않는다 — 그게 9시간 밀림의 원인이었다', () => {
    const stored = '2026-08-11T16:45:30.476903Z';
    const naive = stored.slice(0, 16);
    const shown = toDateTimeLocalValue(stored);
    // 실행 환경이 UTC 면 둘이 같다. 그때는 이 검사가 의미를 갖지 않으므로 건너뛴다.
    if (new Date(stored).getTimezoneOffset() !== 0) expect(shown).not.toBe(naive);
  });

  it('빈 값은 빈 문자열이다', () => {
    expect(toDateTimeLocalValue(null)).toBe('');
    expect(toDateTimeLocalValue(undefined)).toBe('');
    expect(toDateTimeLocalValue('')).toBe('');
  });
});

describe('toOffsetDateTime', () => {
  it('오프셋을 붙인다 — datetime-local 값을 그대로 보내면 서버 파싱이 깨진다', () => {
    const result = toOffsetDateTime('2026-08-11T16:45');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('가리키는 시각은 그대로다', () => {
    expect(new Date(toOffsetDateTime('2026-08-11T16:45') as string).getTime())
      .toBe(new Date('2026-08-11T16:45').getTime());
  });

  it('빈 값은 null 이다 — 서버가 지금 시각을 넣는다', () => {
    expect(toOffsetDateTime('')).toBeNull();
    expect(toOffsetDateTime('   ')).toBeNull();
  });

  it('초까지 있는 값도 받는다', () => {
    expect(toOffsetDateTime('2026-08-11T16:45:30')).toMatch(/:30\.000Z$/);
  });
});

describe('parseTags', () => {
  it('쉼표로 나누고 공백을 턴다', () => {
    expect(parseTags(' react , spring ')).toEqual(['react', 'spring']);
  });

  it('빈 조각과 중복을 버린다', () => {
    expect(parseTags('react,,react, ,spring')).toEqual(['react', 'spring']);
  });

  it('빈 문자열은 빈 배열이다', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags('   ')).toEqual([]);
  });
});

describe('formatTags', () => {
  it('입력칸에 되돌릴 수 있게 쉼표로 잇는다', () => {
    expect(formatTags(['react', 'spring'])).toBe('react, spring');
    expect(parseTags(formatTags(['react', 'spring']))).toEqual(['react', 'spring']);
  });

  it('빈 배열은 빈 문자열이다', () => {
    expect(formatTags([])).toBe('');
  });
});

describe('formatIpPrefix', () => {
  it('IPv4 는 남은 두 옥텟을 별표로 채운다', () => {
    expect(formatIpPrefix('121.135')).toBe('121.135.*.*');
  });

  it('IPv6 는 콜론 표기를 쓴다 — 옥텟 표기를 붙이면 ::1.*.* 가 된다', () => {
    expect(formatIpPrefix('::1')).toBe('::1:*');
    expect(formatIpPrefix('2001:db8')).toBe('2001:db8:*');
  });

  it('비어 있으면 안내 문구를 준다', () => {
    expect(formatIpPrefix('')).toBe('주소 없음');
    expect(formatIpPrefix(null)).toBe('주소 없음');
  });
});

describe('toPostId', () => {
  it('연결 없음(빈 값)은 null 이다 — 0 으로 바뀌면 서버가 없는 글을 찾는다', () => {
    expect(toPostId('')).toBeNull();
    expect(toPostId(null)).toBeNull();
    expect(toPostId('   ')).toBeNull();
  });

  it('고른 글의 id 를 숫자로 준다', () => {
    expect(toPostId('22')).toBe(22);
  });

  it('숫자가 아니거나 0 이하면 연결 없음으로 본다', () => {
    expect(toPostId('abc')).toBeNull();
    expect(toPostId('0')).toBeNull();
    expect(toPostId('-3')).toBeNull();
  });
});
