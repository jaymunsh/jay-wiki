/** 관리 폼의 순수 변환. vitest 가 node 환경이라 여기만 자동 테스트가 가능하다. */

/** 쉼표로 나누고 공백·빈 조각·중복을 턴다. 순서는 입력한 순서를 지킨다. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(',')) {
    const tag = piece.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** 저장된 태그를 입력칸으로 되돌린다. parseTags 와 왕복이 성립해야 한다. */
export function formatTags(tags: readonly string[]): string {
  return tags.join(', ');
}

/**
 * 저장된 발행일을 발행일 입력칸이 읽는 형식으로 바꾼다.
 *
 * 서버는 publishedAt 을 UTC 로 준다(2026-08-11T16:45:30.476903Z). 이 문자열을 그대로
 * 잘라 넣으면 datetime-local 이 그 숫자를 로컬 시각으로 읽어, 화면에 9시간 이른 시각이
 * 보이고 저장할 때마다 그만큼 뒤로 밀린다. 손대지 않고 저장만 눌러도 밀린다.
 *
 * 그래서 자르지 않고 시각으로 되돌려 실행 환경의 시간대로 다시 적는다.
 * toOffsetDateTime 과 짝이다. 둘은 항상 함께 고친다.
 */
export function toDateTimeLocalValue(stored: string | null | undefined): string {
  if (!stored) return '';
  const at = new Date(stored);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
    + `T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * 발행일 입력칸의 값을 서버가 받는 형식으로 바꾼다.
 *
 * `<input type="datetime-local">` 은 `2026-08-11T16:45` 처럼 초도 오프셋도 없이 준다.
 * 서버의 publishedAt 은 OffsetDateTime 이라 그대로 보내면 Jackson 이 index 16 에서 죽는다.
 * 오프셋 없는 값은 실행 환경의 시간대로 해석한다 — 웹·백엔드 pod 모두 TZ=Asia/Seoul 이다.
 *
 * 빈 값은 null 이다. 서버가 published 일 때 지금 시각을 채운다.
 */
export function toOffsetDateTime(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * 시리즈 연결 select 의 값을 서버가 받는 형식으로 바꾼다.
 *
 * '연결 없음'은 빈 문자열로 온다. 그걸 Number 로 바꾸면 0 이 되어 없는 글을 가리키고,
 * 서버는 404 를 던진다. 빈 값은 숫자가 아니라 null 이어야 한다.
 */
export function toPostId(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * 댓글 목록의 IP 표기. 원본은 DB 에도 없고 앞부분만 저장돼 있다(설계 4절).
 * IPv4 는 옥텟 두 개라 `.*.*` 를, IPv6 는 그룹 두 개라 `:*` 를 붙인다.
 * 한 가지로 고정하면 로컬 IPv6 루프백이 `::1.*.*` 처럼 보인다.
 */
export function formatIpPrefix(prefix: string | null | undefined): string {
  const value = (prefix ?? '').trim();
  if (!value) return '주소 없음';
  return value.includes(':') ? `${value}:*` : `${value}.*.*`;
}
