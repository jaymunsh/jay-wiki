/**
 * 방문 첫 순간의 유입 호스트를 담는 세션 쿠키.
 *
 * 댓글 POST 의 Referer 는 그 글 자신이라, 그 시점엔 애초 어디서 들어왔는지가 이미
 * 사라져 있다. 그래서 첫 요청 때 호스트만 담아 두고 Spring 이 댓글을 저장할 때 꺼낸다.
 *
 * 여기서 분류하지 않는 이유는 하나다. 검색·SNS 도메인 목록을 TypeScript 로 한 벌 더
 * 두면 Java 쪽(cloud.leneu.jaywiki.stats.Referrer)과 반드시 갈라진다. 이 파일은
 * 호스트만 뽑고, 무엇으로 셀지는 Java 한 곳에서만 정한다.
 */

/** Java 쪽 EntrySourceCookie.NAME 과 같아야 한다. 한쪽만 바꾸면 값이 조용히 안 실린다. */
export const ENTRY_SOURCE_COOKIE = 'jw_src';

/**
 * Referer 가 아예 없었다는 표시. 빈 문자열을 쓰지 않는 이유는 쿠키가 있는지 없는지와
 * 구별되지 않기 때문이다 -- 구별하지 못하면 직접 들어온 방문자가 다음 화면으로 넘어갈 때
 * 자기 호스트로 덮여 internal 로 잘못 남는다.
 */
export const NO_REFERER = '-';

/**
 * Referer 헤더에서 호스트만 뽑는다. 경로와 쿼리는 버린다 -- 검색어가 거기 있다.
 * 헤더가 없거나 형식이 깨졌으면 NO_REFERER 를 준다.
 */
export function entryHost(referer: string | null): string {
  if (!referer) return NO_REFERER;
  try {
    return new URL(referer).hostname || NO_REFERER;
  } catch {
    return NO_REFERER;
  }
}
