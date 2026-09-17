/**
 * 목록 페이징의 화면 쪽 조각.
 *
 * 자르는 일은 서버가 한다(`/api/blog/posts/page`, `/api/blog/search/page`).
 * 여기 남은 것은 주소에서 페이지 번호를 읽고 다시 주소를 만드는 일뿐이다.
 *
 * 전에는 전체 목록을 받아 이 파일의 paginate 로 잘랐다. 2026-08-29 에 재 보니 지금 편수에서
 * 그 방식이 느린 것은 아니었지만(응답 20KB, 전송 1ms 미만), 어차피 옮겨야 할 일이라
 * 소비자가 셋뿐이고 데이터가 적은 지금 옮겼다.
 */

/**
 * 한 페이지에 30편. 서버의 BlogPageSize.DEFAULT 와 같은 값이어야 한다 --
 * 화면이 size 를 안 보낼 때 서버가 쓰는 값이 이것이라, 다르면 페이저가 실제와 어긋난다.
 * 선택지(10·30·50)는 서버의 BlogPageSize 가 정본이다.
 */
export const BLOG_PAGE_SIZE = 30;

/** `?page=` 값을 페이지 번호로 읽는다. 값이 없거나 숫자가 아니면 1. */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

/**
 * 페이지 링크. 1페이지는 쿼리를 붙이지 않아 정본 주소와 같게 둔다.
 * 검색처럼 basePath 에 이미 쿼리가 있으면 & 로 잇는다.
 */
export function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  return `${basePath}${basePath.includes('?') ? '&' : '?'}page=${page}`;
}
