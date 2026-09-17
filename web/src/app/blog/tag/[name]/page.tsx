import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPostList } from '@/components/blog/BlogPostList';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogPostsPage } from '@/lib/blog';
import { parsePageParam } from '@/lib/blogPaging';
import { BlogPagination } from '@/components/blog/BlogPagination';

export const dynamic = 'force-dynamic';

type Params = { readonly name: string };

/**
 * 태그 페이지는 noindex 로 시작한다 (설계 9절).
 * 글 8편에 태그가 54개라 태그당 1~2편이고, 내용이 거의 없는 페이지가 수십 개 생기면
 * 검색엔진에 도움이 아니라 부담이다. follow 는 남겨 글로 가는 링크는 따라가게 둔다.
 * 글이 쌓이면 이 robots 만 지우면 된다.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { name } = await params;
  return {
    title: `#${decodeURIComponent(name)}`,
    robots: { index: false, follow: true },
  };
}

export default async function BlogTagPage({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { name } = await params;
  const tag = decodeURIComponent(name);
  const page = await getBlogPostsPage({ tag, page: parsePageParam((await searchParams).page) });
  if (page.total === 0) notFound();
  if (page.items.length === 0) notFound();

  return (
    <BlogShell rail={<BlogRail />} title={`#${tag}`} category="태그">
      <div className="blog-cat-head">
        <div className="blog-crumb">
          <Link href="/">전체 글</Link> · <b>#{tag}</b>
        </div>
        <h1>#{tag}</h1>
        <span className="count">{page.total}편</span>
      </div>
      <BlogPostList posts={page.items} />
      <BlogPagination
        basePath={`/tag/${encodeURIComponent(tag)}`}
        page={page.page}
        totalPages={page.totalPages}
      />
    </BlogShell>
  );
}
