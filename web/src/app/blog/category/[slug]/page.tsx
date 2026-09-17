import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { BlogPostList } from '@/components/blog/BlogPostList';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogCategories, getBlogPostsPage } from '@/lib/blog';
import { parsePageParam } from '@/lib/blogPaging';
import { BlogPagination } from '@/components/blog/BlogPagination';

export const dynamic = 'force-dynamic';

type Params = { readonly slug: string };

// generateMetadata 와 본문이 같은 요청 안에서 트리를 두 번 읽지 않도록 memoize.
const getCategoriesCached = cache(getBlogCategories);

/** 2단이므로 부모와 자식만 훑으면 된다. */
async function findCategory(slug: string) {
  const tree = await getCategoriesCached();
  for (const parent of tree) {
    if (parent.slug === slug) return parent;
    const child = parent.children.find((c) => c.slug === slug);
    if (child) return child;
  }
  return null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategory(slug);
  if (!category) return { title: '없는 카테고리', robots: { index: false } };
  const page = parsePageParam((await searchParams).page);
  const description = category.description ?? `${category.name} 카테고리의 글`;
  // 2페이지 이후는 noindex + follow. 이유는 blog/page.tsx 주석 참고.
  if (page > 1) {
    return {
      title: `${category.name} · ${page}페이지`,
      description,
      robots: { index: false, follow: true },
    };
  }
  return {
    title: category.name,
    description,
    alternates: { canonical: `/category/${encodeURIComponent(category.slug)}` },
  };
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const [category, page] = await Promise.all([
    findCategory(slug),
    getBlogPostsPage({ category: slug, page: parsePageParam((await searchParams).page) }),
  ]);
  if (!category) notFound();
  if (page.items.length === 0 && page.total > 0) notFound();

  return (
    <BlogShell rail={<BlogRail active={category.slug} />} title={category.name} category={category.name}>
      <div className="blog-cat-head">
        <div className="blog-crumb">
          <Link href="/">전체 글</Link> · <b>{category.name}</b>
        </div>
        <h1>{category.name}</h1>
        {category.description && <p>{category.description}</p>}
        <span className="count">{page.total}편</span>
      </div>
      <BlogPostList posts={page.items} />
      <BlogPagination
        basePath={`/category/${encodeURIComponent(category.slug)}`}
        page={page.page}
        totalPages={page.totalPages}
      />
    </BlogShell>
  );
}
