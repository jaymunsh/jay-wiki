import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogPagination } from '@/components/blog/BlogPagination';
import { BlogPostList } from '@/components/blog/BlogPostList';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogPostsPage } from '@/lib/blog';
import { parsePageParam } from '@/lib/blogPaging';

export const dynamic = 'force-dynamic'; // 원본 SoT = DB. 항상 최신 목록

/**
 * 1페이지만 정본으로 색인시키고, 2페이지 이후는 noindex + follow 로 둔다.
 *
 * 페이지마다 자기 주소를 canonical 로 주는 쪽이 더 정확하지만 Next 가 canonical 에서
 * 쿼리를 떨어뜨린다(절대 URL 로 넘겨도 같다). 그대로 두면 2페이지가 1페이지를 정본이라고
 * 선언해 더 나쁘다. follow 라 목록의 글 링크는 계속 타고 가고, 글 자체는 사이트맵에도 있다.
 */
export async function generateMetadata({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const page = parsePageParam((await searchParams).page);
  if (page > 1) {
    return { title: `전체 글 · ${page}페이지`, robots: { index: false, follow: true } };
  }
  return { alternates: { canonical: '/' } };
}

export default async function BlogHomePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await getBlogPostsPage({ page: parsePageParam((await searchParams).page) });
  if (page.items.length === 0 && page.total > 0) notFound();

  return (
    <BlogShell rail={<BlogRail active="all" />} title={`전체 글 · ${page.total}편`} category="전체">
      <div className="blog-list-head">
        <h1>전체 글</h1>
        <span className="count">{page.total}편</span>
      </div>
      <BlogPostList posts={page.items} />
      <BlogPagination basePath="/" page={page.page} totalPages={page.totalPages} />
    </BlogShell>
  );
}
