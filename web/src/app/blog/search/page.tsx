import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPagination } from '@/components/blog/BlogPagination';
import { BlogPostList } from '@/components/blog/BlogPostList';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { searchBlogPostsPage } from '@/lib/blog';
import { parsePageParam } from '@/lib/blogPaging';

export const dynamic = 'force-dynamic';

/** 질의마다 주소가 생긴다. 색인시킬 이유가 없으므로 전부 noindex 다. */
export const metadata: Metadata = {
  title: '검색',
  robots: { index: false, follow: true },
};

const MIN_QUERY_LENGTH = 2; // 서버(BlogPostService.MIN_QUERY_LENGTH)와 같은 값

function readQuery(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
}

export default async function BlogSearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = readQuery(params.q);
  const tooShort = q.length > 0 && q.length < MIN_QUERY_LENGTH;
  const page =
    tooShort || q.length === 0
      ? { items: [], page: 1, size: 0, total: 0, totalPages: 1 }
      : await searchBlogPostsPage(q, parsePageParam(params.page));
  if (page.items.length === 0 && page.total > 0) notFound();

  return (
    <BlogShell rail={<BlogRail />} title={q ? `검색 · ${q}` : '검색'} category="검색">
      <div className="blog-list-head">
        <h1>
          {q ? (
            <>
              <strong className="blog-search-query">&apos;{q}&apos;</strong>
              <span className="blog-search-label">에 대한 검색 결과</span>
            </>
          ) : '검색'}
        </h1>
        {q && !tooShort && <span className="count">{page.total}편</span>}
      </div>

      {q.length === 0 && (
        <p className="blog-empty">왼쪽 검색창에 찾을 말을 넣어라. 제목·요약·본문에서 찾는다.</p>
      )}

      {tooShort && <p className="blog-empty">{MIN_QUERY_LENGTH}글자 이상 넣어라.</p>}

      {q && !tooShort && page.total === 0 && (
        <p className="blog-empty">
          &apos;<b>{q}</b>&apos; 로 찾은 글이 없다. <Link href="/">전체 글</Link> 로 돌아간다.
        </p>
      )}

      {page.total > 0 && (
        <>
          <BlogPostList posts={page.items} />
          <BlogPagination
            basePath={`/search?q=${encodeURIComponent(q)}`}
            page={page.page}
            totalPages={page.totalPages}
          />
        </>
      )}
    </BlogShell>
  );
}
