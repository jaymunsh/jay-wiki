import { describe, expect, it } from 'vitest';
import { NO_REFERER, entryHost } from './entrySource';

/**
 * 여기서 분류하지 않는다는 것이 이 함수의 요점이다. 호스트만 뽑고, 그것이 검색인지
 * SNS 인지는 Java 의 stats.Referrer 한 곳에서만 정한다.
 */
describe('entryHost', () => {
  it('호스트만 남기고 경로와 쿼리는 버린다', () => {
    // 검색어가 쿼리에 있다. 여기서 잘라내지 않으면 쿠키를 타고 흘러간다.
    expect(entryHost('https://www.google.com/search?q=비밀검색어')).toBe('www.google.com');
    expect(entryHost('https://blog.leneu.cloud/65/some-post')).toBe('blog.leneu.cloud');
  });

  it('포트는 호스트에 포함하지 않는다', () => {
    // Java 쪽 URI.getHost() 와 결과가 같아야 한다.
    expect(entryHost('http://blog.localhost:3000/65/x')).toBe('blog.localhost');
  });

  it('Referer 가 없으면 없었다는 표시를 남긴다', () => {
    // 빈 문자열을 쓰면 쿠키가 없는 것과 구별되지 않아, 직접 들어온 방문자가
    // 다음 화면에서 자기 호스트로 덮여 internal 로 잘못 남는다.
    expect(entryHost(null)).toBe(NO_REFERER);
    expect(entryHost('')).toBe(NO_REFERER);
  });

  it('형식이 깨진 주소도 던지지 않는다', () => {
    expect(entryHost('not a url')).toBe(NO_REFERER);
    expect(entryHost('h ttp://%%%')).toBe(NO_REFERER);
  });
});
