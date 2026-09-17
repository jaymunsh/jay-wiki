/**
 * 블로그 주소 규칙과 날짜 표기. 순수 함수만 둔다.
 * middleware(edge)와 클라이언트 컴포넌트에서도 import 하므로 server-only 를 넣지 않는다.
 */

/** 블로그 공개 오리진. 빌드 시점에 번들로 인라인된다(NEXT_PUBLIC_). */
export const BLOG_ORIGIN = (
  process.env.NEXT_PUBLIC_BLOG_ORIGIN ?? 'https://blog.leneu.cloud'
).replace(/\/+$/, '');

/** 글 주소. 숫자 id 가 정본이고 slug 는 읽기용이다. */
export function blogPostHref(id: number, slug: string): string {
  return slug ? `/${id}/${encodeURIComponent(slug)}` : `/${id}`;
}

/** canonical·sitemap 처럼 절대 주소가 필요한 곳에서 쓴다. */
export function blogAbsoluteUrl(path: string): string {
  return `${BLOG_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

const KOREAN_TIME_ZONE = 'Asia/Seoul';

/* 포매터는 만드는 값이 비싸다. 목록 한 화면이 날짜 수십 개를 그리므로 모듈에서 한 번 만든다. */
const DATE_TIME_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOREAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const DATE_ONLY = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOREAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * 글 상단의 발행 시각. 2026.08.01 09:30 형태, 24시제.
 *
 * 목록·레일·관련 글은 `formatBlogDate` 로 날짜만 쓴다. 여러 줄이 늘어선 곳에
 * 분까지 붙으면 읽을 것이 아닌 숫자가 늘어난다.
 *
 * 로케일이 넣는 구분자(en-CA 는 `, `)에 기대지 않고 조각에서 직접 맞춘다.
 */
export function formatBlogDateTime(value: string | null | undefined): string {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  const parts = DATE_TIME_PARTS.formatToParts(parsed);
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${at('year')}.${at('month')}.${at('day')} ${at('hour')}:${at('minute')}`;
}

/** 목록·글머리의 날짜. 2026.08.01 형태. */
export function formatBlogDate(value: string | null | undefined): string {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  // en-CA 는 YYYY-MM-DD 를 준다. 구분자만 점으로 바꾼다.
  return DATE_ONLY.format(parsed).replace(/-/g, '.');
}

/**
 * 발행 뒤 실제로 고친 글인지. 안 고친 글은 updatedAt 이 publishedAt 과 같거나 더 이르므로
 * 수정 시각을 적으면 같은 값이 두 번 보인다. 1분 미만 차이는 발행 절차가 만든 것으로 보고 무시한다.
 */
export function isEditedAfterPublish(
  publishedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): boolean {
  if (!publishedAt || !updatedAt) return false;
  const published = new Date(publishedAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(published) || Number.isNaN(updated)) return false;
  return updated - published >= 60_000;
}
