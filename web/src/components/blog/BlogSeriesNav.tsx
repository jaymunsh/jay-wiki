import Link from 'next/link';
import type { BlogPostSummary } from '@/lib/blog';
import { blogPostHref } from '@/lib/blogLinks';

/**
 * 글쓴이가 이어 둔 앞뒤 글. 목차 위에 그린다.
 *
 * 본문 맨 아래의 `.blog-art-nav` 와 뜻이 다르다. 그쪽은 발행일 순서라 22번의 다음이 23번이고,
 * 여기는 22번을 쓰고 이어서 쓴 37번이다. 라벨이 「먼저 읽기 / 이어 읽기」인 것도 그래서다 --
 * 한 화면에 둘이 같이 있으므로 하단의 「이전 글 / 다음 글」과 같은 말로 읽히면 안 된다.
 * 글의 순서가 아니라 읽는 사람이 할 행동으로 적었다.
 *
 * 연결이 하나도 없으면 아무것도 안 그린다.
 */
export function BlogSeriesNav({
  prev,
  next,
}: {
  readonly prev?: BlogPostSummary | null;
  readonly next?: BlogPostSummary | null;
}) {
  if (!prev && !next) return null;

  // 둘 다 있으면 두 칸, 하나면 한 칸. 레일과 노드의 자리도 이 값으로 정한다.
  const side = prev && next ? 'both' : prev ? 'prev' : 'next';

  return (
    <nav className="blog-series" data-side={side} aria-label="이어지는 글">
      {prev && (
        <Link className="blog-series__side" href={blogPostHref(prev.id, prev.slug)}>
          <span className="blog-series__label">← 먼저 읽기</span>
          <b>{prev.title}</b>
        </Link>
      )}
      {next && (
        <Link
          className="blog-series__side blog-series__side--next"
          href={blogPostHref(next.id, next.slug)}
        >
          <span className="blog-series__label">이어 읽기 →</span>
          <b>{next.title}</b>
        </Link>
      )}
    </nav>
  );
}
