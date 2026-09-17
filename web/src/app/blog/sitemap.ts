import type { MetadataRoute } from 'next';
import { getBlogCategories, getBlogPosts } from '@/lib/blog';
import { blogAbsoluteUrl, blogPostHref } from '@/lib/blogLinks';

export const dynamic = 'force-dynamic'; // 원본 SoT = DB

/**
 * 블로그 전용 sitemap. 위키(portfolio) sitemap 과 분리한다 — 호스트가 다르고 담는 글도 다르다.
 * 태그 페이지는 noindex 이므로 넣지 않는다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const categorySlugs = categories.flatMap((c) => [c.slug, ...c.children.map((ch) => ch.slug)]);

  return [
    { url: blogAbsoluteUrl('/') },
    { url: blogAbsoluteUrl('/privacy') },
    ...categorySlugs.map((slug) => ({
      url: blogAbsoluteUrl(`/category/${encodeURIComponent(slug)}`),
    })),
    ...posts.map((post) => ({
      url: blogAbsoluteUrl(blogPostHref(post.id, post.slug)),
      lastModified: post.publishedAt ? new Date(post.publishedAt) : undefined,
    })),
  ];
}
