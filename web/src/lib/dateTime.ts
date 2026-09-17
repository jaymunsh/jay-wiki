const KOREAN_TIME_ZONE = 'Asia/Seoul';

/* Intl.DateTimeFormat 은 만드는 값이 비싸고 포맷하는 값은 싸다. 호출마다 새로 만들면
   목록 한 화면에 날짜 60개를 그릴 때 60번 만든다. 모양이 고정인 것은 모듈에서 한 번 만든다.
   초 표시만 옵션으로 갈리므로 그것만 둘로 둔다. */
const DATE_TIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KOREAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const TIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KOREAN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const TIME_WITH_SECONDS = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KOREAN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const DATE_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOREAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const MONTH_DAY = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KOREAN_TIME_ZONE,
  month: '2-digit',
  day: '2-digit',
});

function parseDate(value: string | number | Date): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatKoreanDateTime(value: string | number | Date): string {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return DATE_TIME.format(parsed);
}

export function formatKoreanTime(
  value: string | number | Date,
  options: { readonly seconds?: boolean } = {},
): string {
  const parsed = parseDate(value);
  if (!parsed) return options.seconds ? '--:--:--' : '--:--';
  return (options.seconds ? TIME_WITH_SECONDS : TIME).format(parsed);
}

function koreanDateKey(value: string | number | Date): string | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return DATE_KEY.format(parsed);
}

export function formatKoreanBoardDate(
  value: string | number | Date,
  now: string | number | Date = new Date(),
): string {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  if (koreanDateKey(parsed) === koreanDateKey(now)) return formatKoreanTime(parsed);
  return MONTH_DAY.format(parsed);
}

/**
 * 목록 오른쪽에 붙는 날짜. 올해 것은 연도를 뗀다.
 *
 * 첫 화면의 목록 카드가 좁아 제목이 잘리는데, 거기서 연도는 전부 같은 값이라 자리만 먹는다.
 * 해가 바뀐 글에는 남긴다 — 그때는 연도가 진짜 정보다.
 * 판정은 UTC 가 아니라 서울 달력으로 한다. 연말 자정 근처에서 갈리는 자리다.
 */
export function formatWikiListDate(
  value: string | number | Date | null | undefined,
  now: string | number | Date = new Date(),
): string {
  if (!value) return '--';
  const parsed = parseDate(value);
  if (!parsed) return '--';
  const key = koreanDateKey(parsed);
  if (!key) return '--';
  const [year, month, day] = key.split('-');
  const nowYear = koreanDateKey(now)?.slice(0, 4);
  return year === nowYear ? `${month}-${day}` : `${year.slice(2)}-${month}-${day}`;
}

/**
 * ISO 날짜 최신순 정렬. 이식된 옛 글은 createdAt 이 null 일 수 있으므로 맨 뒤로 보낸다.
 */
export function compareNullableIsoDateDesc(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return (right ?? '').localeCompare(left ?? '');
}
