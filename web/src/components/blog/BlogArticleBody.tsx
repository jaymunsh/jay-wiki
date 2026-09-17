'use client';

import { useRef } from 'react';
import { BlogImageLightbox } from './BlogImageLightbox';
import { MermaidDiagrams } from '@/components/MermaidDiagrams';

/**
 * 블로그 본문. 위키의 ArticleBody 와 같은 모양이다.
 *
 * mermaid 는 브라우저에서 .mermaid 노드를 찾아 그리므로 그 노드를 감싸는 ref 가 필요하다.
 * 글 화면은 서버 컴포넌트라 ref 를 들 수 없어서 이 조각만 클라이언트로 뗀다.
 * 이게 없으면 mermaid 블록이 코드 그대로 남는다 — 이관 8편 중 6편이 mermaid 를 쓴다.
 *
 * HTML 은 서버에서 이미 만들어 넘긴다. 여기서 markdown 을 다시 렌더하면
 * 같은 일을 클라이언트 번들에서 한 번 더 하게 된다.
 */
export function BlogArticleBody({
  html,
  signal,
}: {
  readonly html: string;
  readonly signal: string;
}) {
  const proseRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={proseRef}
        className="prose blog-art-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <MermaidDiagrams scopeRef={proseRef} signal={signal} />
      <BlogImageLightbox scopeRef={proseRef} signal={signal} />
    </>
  );
}
