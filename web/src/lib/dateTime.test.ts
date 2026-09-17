import { describe, expect, it } from 'vitest';
import {
  compareNullableIsoDateDesc,
  formatKoreanBoardDate,
  formatKoreanDateTime,
  formatKoreanTime,
  formatWikiListDate,
} from './dateTime';

describe('Korean date presentation', () => {
  const instant = '2026-07-22T09:11:26.438011Z';

  it('renders an absolute instant in Asia/Seoul regardless of the server timezone', () => {
    expect(formatKoreanDateTime(instant)).toBe('2026. 07. 22. 18:11');
    expect(formatKoreanTime(instant)).toBe('18:11');
  });

  it('uses the Seoul calendar date when deciding whether a board item is today', () => {
    expect(formatKoreanBoardDate(instant, '2026-07-22T14:30:00Z')).toBe('18:11');
    expect(formatKoreanBoardDate(instant, '2026-07-22T15:30:00Z')).toBe('07. 22.');
  });

  it('drops the year from list dates only while the article is from the current Seoul year', () => {
    expect(formatWikiListDate(instant, '2026-01-01T00:00:00Z')).toBe('07-22');
    expect(formatWikiListDate(instant, '2027-03-02T00:00:00Z')).toBe('26-07-22');
    expect(formatWikiListDate(undefined)).toBe('--');
    expect(formatWikiListDate('not-a-date')).toBe('--');
  });

  it('decides the year boundary on the Seoul calendar, not UTC', () => {
    // 서울로 2027-01-01 00:11 인 순간. UTC 로는 아직 2026-12-31 이다.
    const seoulNewYear = '2026-12-31T15:11:00Z';
    expect(formatWikiListDate(seoulNewYear, seoulNewYear)).toBe('01-01');
    expect(formatWikiListDate(instant, seoulNewYear)).toBe('26-07-22');
  });

  it('sorts missing legacy article dates after real dates', () => {
    expect(compareNullableIsoDateDesc(null, '2026-08-20T21:47:38Z')).toBeGreaterThan(0);
    expect(compareNullableIsoDateDesc('2026-08-20T21:47:38Z', null)).toBeLessThan(0);
    expect(compareNullableIsoDateDesc(null, undefined)).toBe(0);
  });
});
