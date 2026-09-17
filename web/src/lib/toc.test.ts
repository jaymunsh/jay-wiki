import { describe, expect, it } from 'vitest';

import { renderMarkdownPreview } from './markdown';
import { extractToc, headingSlug } from './toc';

describe('extractToc', () => {
  it('## 과 ### 을 모으고 # 은 거른다', () => {
    // 화면이 제목을 따로 그리므로 본문에 # 은 쓰지 않는다. 실제로 글 16편에 하나도 없다.
    const toc = extractToc('# 제목\n\n## 하나\n\n### 둘\n\n## 셋');
    expect(toc.map((entry) => [entry.text, entry.depth])).toEqual([
      ['하나', 2],
      ['둘', 3],
      ['셋', 2],
    ]);
  });

  it('#### 은 세지 않는다', () => {
    expect(extractToc('## 하나\n\n#### 넷')).toHaveLength(1);
  });

  it('코드 펜스 안의 # 은 목차에 올리지 않는다', () => {
    // 셸 예시의 주석이 목차에 오르면 링크가 아무 데도 안 닿는다.
    const body = ['## 진짜', '', '```bash', '## 가짜 주석', '```', '', '## 또 진짜'].join('\n');
    expect(extractToc(body).map((entry) => entry.text)).toEqual(['진짜', '또 진짜']);
  });

  it('``` 안에 들어 있는 ~~~ 로는 펜스가 닫히지 않는다', () => {
    const body = ['```md', '~~~', '## 가짜', '```', '', '## 진짜'].join('\n');
    expect(extractToc(body).map((entry) => entry.text)).toEqual(['진짜']);
  });

  it('제목의 인라인 마크다운을 걷어낸다', () => {
    const toc = extractToc('## `cf-cache-status` 가 **어느 겹**인지 알려 준다');
    expect(toc[0]?.text).toBe('cf-cache-status 가 어느 겹인지 알려 준다');
  });

  it('제목이 겹치면 뒤에 번호를 붙여 id 가 갈린다', () => {
    const toc = extractToc('## 같은 제목\n\n## 같은 제목');
    expect(toc.map((entry) => entry.id)).toEqual(['같은-제목', '같은-제목-2']);
  });

  // 켜고 끄는 것은 toc_enabled 컬럼이 한다(V19·V20). 이 함수는 본문에서 뽑기만 한다.
  it('본문의 주석은 목차에 영향을 주지 않는다', () => {
    expect(extractToc('<!-- 메모 -->\n\n## 하나\n\n## 둘').map((e) => e.text)).toEqual(['하나', '둘']);
  });
});

describe('목차와 본문의 앵커가 서로 닿는다', () => {
  /**
   * 이게 이 기능의 유일한 계약이다. 목차의 id 규칙과 렌더러의 id 규칙이 갈리면
   * 링크는 조용히 아무 데도 안 닿는다 — 화면은 멀쩡해 보인다.
   */
  it('목차가 만든 id 가 렌더된 h2 에 그대로 있다', () => {
    const body = '## 첫 결정을 적는다\n\n본문\n\n## `코드` 가 든 제목\n\n본문';
    const html = renderMarkdownPreview(body);
    for (const entry of extractToc(body)) {
      expect(html).toContain(`id="${entry.id}"`);
    }
  });

  it('같은 본문을 두 번 렌더해도 id 가 늘어나지 않는다', () => {
    // 카운터를 매 렌더마다 비우지 않으면 두 번째 렌더에서 -2 가 붙는다.
    const body = '## 하나\n\n## 둘';
    expect(renderMarkdownPreview(body)).toBe(renderMarkdownPreview(body));
  });

  it('본문 주석이 화면에 글자로 남지 않는다', () => {
    const html = renderMarkdownPreview('<!-- 메모 -->\n\n## 하나');
    expect(html).not.toContain('메모');
  });
});

describe('headingSlug', () => {
  it('한글을 남기고 나머지는 하이픈으로 잇는다', () => {
    expect(headingSlug('동시 5방이라는 상한 하나가')).toBe('동시-5방이라는-상한-하나가');
  });

  it('남는 글자가 없으면 기본값을 준다', () => {
    expect(headingSlug('!!!')).toBe('section');
  });
});
