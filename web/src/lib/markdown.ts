import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import properties from 'highlight.js/lib/languages/properties';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { Marked } from 'marked';
import { extractToc, headingSlug, stripInline } from './toc';
import { markedHighlight } from 'marked-highlight';
import sanitizeHtml from 'sanitize-html';

/**
 * highlight.js 를 통짜로 부르면 언어 정의 83개가 전부 브라우저로 간다(청크 1.13MB).
 * 이 저장소의 글이 실제로 쓰는 언어는 아래가 전부다. 언어를 새로 쓰려면 여기 등록한다.
 * 표기 없는 블록은 plaintext 로 간다(아래 highlight 참고).
 */
for (const [name, def] of Object.entries({
  bash, diff, dockerfile, ini, java, javascript, json, markdown,
  plaintext, properties, python, sql, typescript, xml, yaml,
})) {
  hljs.registerLanguage(name, def);
}

/**
 * Markdown → HTML 렌더 (클라이언트/서버 공용, 브라우저 안전).
 * 본문 SoT 가 DB(raw markdown)로 바뀌어 frontmatter 파싱(gray-matter)은 불필요해짐.
 * - marked + marked-highlight + highlight.js 로 코드 하이라이트.
 */
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      try {
        if (lang?.trim().toLowerCase() === 'mermaid') {
          return code;
        }
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        // 표기 없는 블록은 추측하지 않는다. highlightAuto 는 블록마다 다른 언어를
        // 골라, 같은 종류의 출력인데도 색이 제각각이 된다(알림 예시 넷이 각각
        // built_in·number·title 로 칠해졌다). 색이 필요하면 언어를 적는다.
        return hljs.highlight(code, { language: 'plaintext' }).value;
      } catch {
        return code;
      }
    },
  })
);

/**
 * `##` 에 붙일 앵커 id 를 한 번의 파싱 안에서만 겹치지 않게 센다.
 * `renderMarkdownPreview` 가 매번 비운다 — 렌더는 동기라 호출끼리 섞이지 않는다.
 */
const headingSeen = new Map<string, number>();

marked.use({
  renderer: {
    html(token) {
      const raw = token.text.trim();
      // 주석은 비운다. 글쓴이가 남긴 메모가 화면에 글자로 보이면 안 된다.
      if (/^<!--[\s\S]*-->\s*$/.test(raw)) return '';
      /**
       * 접는 블록만 통과시킨다. 토큰이 `<details>`·`<summary>` 여닫는 태그와 글자로만
       * 이루어졌을 때에 한한다 — marked 가 여러 줄을 한 토큰으로 묶어 주기 때문에
       * 정확 일치로는 못 잡는다. 속성은 허용하지 않고 글자는 이스케이프한다.
       * 본문이 넘길 수 있는 것은 「접힌다」는 사실뿐이고, 나머지 HTML 은 글자로 남는다.
       */
      const parts = token.text.split(/(<\/?[a-z][^>]*>)/i);
      const onlyFold = parts.every(
        (part) => !part.startsWith('<') || /^<\/?(details|summary)>$/i.test(part)
      );
      if (onlyFold)
        return parts
          .map((part) => (part.startsWith('<') ? part.toLowerCase() : escapeHtml(part)))
          .join('');
      return escapeHtml(token.text);
    },
    /**
     * 목차가 모으는 깊이(`##`, `###`)에만 앵커를 단다.
     * id 규칙은 `toc.ts` 의 것을 그대로 쓴다 — 갈리면 목차 링크가 아무 데도 안 닿는다.
     */
    heading(token) {
      if (token.depth !== 2 && token.depth !== 3) return false;
      const base = headingSlug(stripInline(token.text));
      const count = headingSeen.get(base) ?? 0;
      headingSeen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;
      const tag = `h${token.depth}`;
      return `<${tag} id="${escapeHtml(id)}">${this.parser.parseInline(token.tokens)}</${tag}>\n`;
    },
    code(token) {
      const language = token.lang?.trim().toLowerCase();
      if (language === 'youtube' || language === 'youtube-embed') {
        const videoId = parseYouTubeVideoId(token.text);
        if (videoId) {
          return `<div class="youtube-embed"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(videoId)}" title="YouTube 영상" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
        }
      }
      if (token.lang?.trim().toLowerCase() === 'mermaid') {
        return `<div class="mermaid">${escapeHtml(token.text)}</div>`;
      }
      return false;
    },
    image(token) {
      const options = parseImageOptions(token.title);
      const title = options || !token.title ? '' : ` title="${escapeHtml(token.title)}"`;
      const width = options?.width ? ` width="${options.width}"` : '';
      const className = options?.align ? ` class="wiki-image-${options.align}"` : '';
      return `<img src="${escapeHtml(token.href)}" alt="${escapeHtml(token.text)}"${title}${width}${className} loading="lazy">`;
    },
  },
});

/**
 * GFM 은 `~한쪽~` 도 취소선으로 본다. 한국어 본문에서 물결표는 거의 항상 범위 표기라
 * "15~18콜"과 "1~2%"가 한 문단에 있으면 그 사이가 통째로 취소선 토큰이 되고,
 * sanitize 가 허용 목록에 없는 `del` 을 지우면서 물결표와 그 안의 서식까지 사라졌다.
 * 실제로 발행된 글의 "-0.55%~-0.65%"가 "-0.55%-0.65%"로 나가 뺄셈처럼 읽혔다.
 * 그래서 취소선은 `~~두 개~~` 로만 인정한다.
 */
marked.use({
  tokenizer: {
    del(src) {
      // false 를 돌려주면 marked 가 기본 토크나이저로 되돌아간다. 토큰 없음은 undefined 다.
      const match = /^~~(?=\S)([\s\S]*?\S)~~/.exec(src);
      if (!match) return undefined;
      return {
        type: 'del',
        raw: match[0],
        text: match[1],
        tokens: this.lexer.inlineTokens(match[1]),
      };
    },
  },
});

marked.setOptions({ gfm: true, breaks: false });

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // del 은 sanitize-html 기본 허용 목록에 없다. 빠져 있으면 취소선이 지워지는 데
  // 그치지 않고 마크업 안쪽 글자까지 함께 사라진다.
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'div', 'img', 'del', 'details', 'summary', 'iframe'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    code: ['class'],
    div: ['class'],
    // 목차가 거는 앵커. 없으면 sanitize 가 id 를 떼어 링크가 안 닿는다.
    h2: ['id'],
    h3: ['id'],
    iframe: ['src', 'title', 'loading', 'allow', 'referrerpolicy', 'allowfullscreen'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class'],
    span: ['class'],
  },
  allowedClasses: {
    code: [/^hljs$/, /^language-/],
    div: ['mermaid', 'youtube-embed'],
    img: ['wiki-image-left', 'wiki-image-center', 'wiki-image-right'],
    span: [/^hljs-/],
  },
  allowedIframeHostnames: ['www.youtube-nocookie.com'],
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
};

/**
 * 맨 앞의 `# 제목` 한 줄을 뗀다. 화면은 제목을 머리말에 따로 그리므로 본문이 다시 쓰면
 * 같은 제목이 두 번 보인다. 위키 글 58편이 전부 이 형태이고, 블로그는 발행 스크립트가
 * 같은 일을 이미 하고 있었다 — 규칙을 렌더러 한 곳으로 모은다.
 * `##` 는 건드리지 않는다(`#` 뒤 공백을 요구하므로 매칭되지 않는다).
 */
function stripLeadingH1(body: string): string {
  return body.replace(/^\s*#[ \t]+[^\n]*(\n|$)/, '');
}

/**
 * raw markdown 본문 → HTML.
 *
 * `toc: true` 면(위키의 tocEnabled 컬럼) 목차를 세 줄 요약 바로 아래에 끼운다.
 * 요약은 글쓰기 규칙상 본문 맨 앞의 불릿 목록이라, 렌더된 HTML 의 첫 `</ul>` 뒤가 그 자리다.
 * 요약이 없는 글이면 본문 맨 앞에 둔다.
 */
export function renderMarkdownPreview(body: string, options?: { readonly toc?: boolean }): string {
  headingSeen.clear();
  const html = marked.parse(stripLeadingH1(body ?? '')) as string;
  const safeHtml = sanitizeHtml(html, SANITIZE_OPTIONS)
    .replaceAll(/<table\b[^>]*>[\s\S]*?<\/table>/g, (table) => `<div class="table-scroll">${table}</div>`);
  if (!options?.toc) return safeHtml;

  // sanitize 를 지난 뒤에 끼운다. 아래 markup 은 본문이 아니라 우리가 만드는 것이고
  // 글자·id 는 전부 escape 를 거친다.
  const toc = tocHtml(body ?? '');
  if (!toc) return safeHtml;
  const firstList = safeHtml.indexOf('</ul>');
  if (firstList === -1) return toc + safeHtml;
  const cut = firstList + '</ul>'.length;
  return safeHtml.slice(0, cut) + toc + safeHtml.slice(cut);
}

/**
 * 목차 markup. BlogToc 와 같은 규칙 — 항목이 둘 이하면 목차라기보다
 * 제목을 한 번 더 적은 것이라 그리지 않는다.
 * class 를 blog-toc 로 쓰는 것은 의도다. 목차의 생김새는 사이트 하나에 하나면 된다.
 */
function tocHtml(body: string): string {
  const entries = extractToc(body);
  if (entries.length < 3) return '';
  const items = entries
    .map((entry) =>
      `<li data-depth="${entry.depth}"><a href="#${escapeHtml(entry.id)}"><span>${escapeHtml(entry.text)}</span><i aria-hidden="true">→</i></a></li>`)
    .join('');
  return `<nav class="blog-toc" aria-label="목차"><p class="blog-toc__head">목차</p><ul>${items}</ul></nav>`;
}

type ImageOptions = {
  readonly width?: number;
  readonly align?: 'left' | 'center' | 'right';
};

function parseImageOptions(title: string | null): ImageOptions | null {
  if (!title) return null;

  const options: { width?: number; align?: 'left' | 'center' | 'right' } = {};
  for (const part of title.trim().split(/\s+/)) {
    const [key, value, extra] = part.split('=');
    if (extra !== undefined || !value) return null;

    if (key === 'width') {
      if (!/^\d+$/.test(value)) return null;
      const width = Number(value);
      if (width < 64 || width > 1200) return null;
      options.width = width;
      continue;
    }

    if (key === 'align' && (value === 'left' || value === 'center' || value === 'right')) {
      options.align = value;
      continue;
    }

    return null;
  }

  return Object.keys(options).length > 0 ? options : null;
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * youtube 코드펜스에는 URL만 받는다. raw iframe을 허용하는 대신 URL에서 영상 ID를
 * 추출하고, 우리가 만든 youtube-nocookie iframe만 렌더링해 외부 HTML 실행 경계를 유지한다.
 */
function parseYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (YOUTUBE_VIDEO_ID.test(input)) return input;
  if (!/^https:\/\//i.test(input)) return null;

  try {
    const url = new URL(input);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return YOUTUBE_VIDEO_ID.test(id) ? id : null;
    }

    if (url.hostname !== 'www.youtube.com' && url.hostname !== 'youtube.com') return null;
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v') ?? '';
      return YOUTUBE_VIDEO_ID.test(id) ? id : null;
    }
    if (url.pathname.startsWith('/embed/')) {
      const id = url.pathname.slice('/embed/'.length).split('/')[0] ?? '';
      return YOUTUBE_VIDEO_ID.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
