import { describe, expect, it } from 'vitest';
import { pageHref, parsePageParam } from './blogPaging';

describe('parsePageParam', () => {
  it('숫자를 읽는다', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam(['2', '5'])).toBe(2);
  });

  it('없거나 숫자가 아니면 1', () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam('nope')).toBe(1);
    expect(parsePageParam('-2')).toBe(1);
  });
});

describe('pageHref', () => {
  it('1페이지는 쿼리를 붙이지 않는다', () => {
    expect(pageHref('/category/dev', 1)).toBe('/category/dev');
  });

  it('2페이지부터 page 쿼리', () => {
    expect(pageHref('/', 2)).toBe('/?page=2');
  });

  it('쿼리가 이미 있으면 & 로 잇는다', () => {
    expect(pageHref('/search?q=캐시', 2)).toBe('/search?q=캐시&page=2');
  });
});
