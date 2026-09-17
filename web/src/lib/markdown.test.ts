import { describe, expect, it } from 'vitest';

import { renderMarkdownPreview } from './markdown';

describe('renderMarkdownPreview', () => {
  it('escapes raw HTML when an article contains executable markup', () => {
    // Given
    const body = '<img src=x onerror="alert(1)">';

    // When
    const html = renderMarkdownPreview(body);

    // Then
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('drops the leading H1 so the title is not shown twice', () => {
    // Given — 화면 머리말이 제목을 이미 그린다
    const body = '# 재부팅 뒤에도 서비스가 돌아오는지\n\n첫 문단이다.\n\n## 절 제목';

    // When
    const html = renderMarkdownPreview(body);

    // Then
    expect(html).not.toContain('<h1');
    expect(html).toContain('첫 문단이다.');
    expect(html).toContain('<h2 id="절-제목">');
  });

  it('keeps an H1 that appears in the middle of the body', () => {
    // Given
    const html = renderMarkdownPreview('첫 문단.\n\n# 중간 제목');

    // Then
    expect(html).toContain('<h1');
  });

  it('keeps Mermaid code blocks available to the diagram renderer', () => {
    // Given
    const body = '~~~mermaid\nflowchart LR\n  A --> B\n~~~';

    // When
    const html = renderMarkdownPreview(body);

    // Then
    expect(html).toContain('<div class="mermaid">');
    expect(html).toContain('A --&gt; B');
  });

  it('renders a validated YouTube fence as a privacy-enhanced iframe', () => {
    const html = renderMarkdownPreview('~~~youtube\nhttps://youtu.be/xuWCNbn3vk0\n~~~');

    expect(html).toContain('<div class="youtube-embed">');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/xuWCNbn3vk0"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('<pre>');
  });

  it('does not turn an unapproved video URL into an iframe', () => {
    const html = renderMarkdownPreview('~~~youtube\nhttps://example.com/video\n~~~');

    expect(html).not.toContain('<iframe');
    expect(html).toContain('https://example.com/video');
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'])(
    'removes an unsafe link scheme: %s',
    (href) => {
      // Given
      const body = `[실행 링크](${href})`;

      // When
      const html = renderMarkdownPreview(body);

      // Then
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('data:text/html');
    },
  );

  it('keeps a same-origin wiki asset image path', () => {
    const id = '1d21c16a-0a45-4bdd-a529-c180679014e0';

    const html = renderMarkdownPreview(`![구성도](/api/wiki-assets/${id})`);

    expect(html).toContain(`src="/api/wiki-assets/${id}"`);
    expect(html).toContain('alt="구성도"');
  });

  it('renders bounded width and alignment options for a Markdown image', () => {
    // Given
    const body = '![앱 아이콘](/assets/projects/donts3p-icon.webp "width=240 align=center")';

    // When
    const html = renderMarkdownPreview(body);

    // Then
    expect(html).toContain('width="240"');
    expect(html).toContain('class="wiki-image-center"');
    expect(html).not.toContain('title="width=240 align=center"');
  });

  it('does not apply an image width outside the supported range', () => {
    const html = renderMarkdownPreview('![이미지](/safe.png "width=99999 align=center")');

    expect(html).not.toContain('width="99999"');
    expect(html).not.toContain('wiki-image-center');
  });

  // 발행된 글에서 "-0.55%~-0.65%"가 "-0.55%-0.65%"로 나갔다. GFM 이 두 물결표 사이를
  // 취소선으로 묶고, sanitize 가 del 을 지우며 물결표까지 함께 사라진 결과다.
  it('keeps a tilde that separates a numeric range instead of reading it as strikethrough', () => {
    const html = renderMarkdownPreview('공격형은 -0.55%~-0.65%, 안정형은 +0.02%~+0.19%였다.');

    expect(html).toContain('-0.55%~-0.65%');
    expect(html).toContain('+0.02%~+0.19%');
    expect(html).not.toContain('<del>');
  });

  it('keeps bold intact when two ranges surround it on one line', () => {
    const html = renderMarkdownPreview('하루 15~18콜은 **한도의 1~2%** 다.');

    expect(html).toContain('<strong>한도의 1~2%</strong>');
    expect(html).not.toContain('**');
  });

  it('still renders a double-tilde strikethrough', () => {
    const html = renderMarkdownPreview('~~지난 계획~~ 은 폐기했다.');

    expect(html).toContain('<del>지난 계획</del>');
  });

  // 위키 목차는 tocEnabled 컬럼이 켠다. 세 줄 요약(첫 불릿 목록) 바로 아래에 그린다.
  it('renders a toc after the summary list when the option is on', () => {
    const body = '- 요약 하나다.\n- 요약 둘이다.\n- 요약 셋이다.\n\n## 하나\n\n## 둘\n\n## 셋\n';
    const html = renderMarkdownPreview(body, { toc: true });

    expect(html).toContain('<nav class="blog-toc"');
    expect(html).toContain('href="#하나"');
    expect(html.indexOf('</ul>')).toBeLessThan(html.indexOf('blog-toc'));
    expect(html.indexOf('blog-toc')).toBeLessThan(html.indexOf('<h2'));
  });

  it('renders no toc when the option is off, and none under three headings', () => {
    expect(renderMarkdownPreview('## 하나\n\n## 둘\n\n## 셋\n')).not.toContain('blog-toc');
    expect(renderMarkdownPreview('## 하나\n\n## 둘\n', { toc: true })).not.toContain('blog-toc');
  });
});
