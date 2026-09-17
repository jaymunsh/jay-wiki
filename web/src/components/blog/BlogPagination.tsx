import Link from 'next/link';
import { pageHref } from '@/lib/blogPaging';

/**
 * 목록 하단 페이지 이동. 한 장뿐이면 아무것도 그리지 않는다.
 * 번호를 전부 늘어놓는다 - 지금 규모에서 생략 부호(…)를 넣을 만큼 페이지가 많지 않다.
 */
export function BlogPagination({
  basePath,
  page,
  totalPages,
}: {
  readonly basePath: string;
  readonly page: number;
  readonly totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="blog-pager" aria-label="페이지">
      {page > 1 ? (
        <Link className="blog-pager-step" href={pageHref(basePath, page - 1)} rel="prev">
          ← 이전
        </Link>
      ) : (
        <span className="blog-pager-step is-off">← 이전</span>
      )}

      <span className="blog-pager-nums">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) =>
          n === page ? (
            <span key={n} className="blog-pager-num is-on" aria-current="page">
              {n}
            </span>
          ) : (
            <Link key={n} className="blog-pager-num" href={pageHref(basePath, n)}>
              {n}
            </Link>
          ),
        )}
      </span>

      {page < totalPages ? (
        <Link className="blog-pager-step" href={pageHref(basePath, page + 1)} rel="next">
          다음 →
        </Link>
      ) : (
        <span className="blog-pager-step is-off">다음 →</span>
      )}
    </nav>
  );
}
