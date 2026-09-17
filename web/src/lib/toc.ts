/**
 * 글 목차. `##` 과 `###` 을 모은다.
 *
 * `#` 은 세지 않는다 — 화면이 제목을 따로 그리므로 본문은 `##` 부터 시작한다.
 * 발행 스크립트도 첫 H1 을 떼어낸다. 실제로 글 16편에 `#` 은 하나도 없다.
 */

export type TocEntry = {
  readonly id: string;
  readonly text: string;
  /** 2 = `##`, 3 = `###`. 화면이 들여쓰기에 쓴다. */
  readonly depth: 2 | 3;
};

/**
 * 제목 → 앵커 id.
 *
 * 마크다운 렌더러와 **같은 규칙을 써야** 목차의 링크가 실제 제목에 닿는다.
 * 그래서 이 함수 하나를 양쪽이 함께 쓴다.
 */
export function headingSlug(text: string): string {
  const slug = stripInline(text)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/** 제목 줄에 남은 인라인 마크다운을 걷어낸다. `**굵게**`, `` `코드` ``, 링크. */
export function stripInline(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim();
}

/**
 * 본문에서 `##` 을 순서대로 뽑는다.
 *
 * 코드 펜스 안은 건너뛴다. 셸 예시의 `# 주석`이나 마크다운을 설명하는 코드블록이
 * 목차에 올라오면 링크가 아무 데도 안 닿는다.
 */
export function extractToc(body: string): readonly TocEntry[] {
  if (!body) return [];

  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  let fence: string | undefined;

  for (const line of body.split('\n')) {
    const trimmed = line.trim();

    const marker = /^(```|~~~)/.exec(trimmed)?.[1];
    if (marker) {
      // 같은 종류의 펜스로만 닫는다. ``` 안에 ~~~ 가 들어간 글이 실제로 있다.
      if (!fence) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }
    if (fence) continue;

    const heading = /^(###|##)\s+(.+?)\s*#*$/.exec(trimmed);
    if (!heading?.[2]) continue;

    const depth = heading[1] === '##' ? 2 : 3;
    const text = stripInline(heading[2]);
    if (!text) continue;

    const base = headingSlug(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    entries.push({ id: count === 0 ? base : `${base}-${count + 1}`, text, depth });
  }

  return entries;
}
