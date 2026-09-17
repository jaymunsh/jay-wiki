import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { BlogArticleBody } from '@/components/blog/BlogArticleBody';
import { BlogToc } from '@/components/blog/BlogToc';
import { BlogComments } from '@/components/blog/BlogComments';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogSeriesNav } from '@/components/blog/BlogSeriesNav';
import { BlogShell } from '@/components/blog/BlogShell';
import {
  getBlogComments,
  getBlogNeighbors,
  getBlogPost,
  getBlogPostsByCategory,
} from '@/lib/blog';
import {
  blogPostHref,
  formatBlogDate,
  formatBlogDateTime,
  isEditedAfterPublish,
} from '@/lib/blogLinks';
import { renderMarkdownPreview } from '@/lib/markdown';
import { extractToc } from '@/lib/toc';

export const dynamic = 'force-dynamic';

type Params = { readonly id: string; readonly slug: string };

// generateMetadata 와 본문이 같은 요청 안에서 글을 두 번 읽지 않도록 memoize.
// 이 API 가 조회수를 올리므로 memoize 하지 않으면 한 번 열 때 2가 오른다.
const getPostCached = cache(getBlogPost);

function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const numeric = parseId(id);
  const post = numeric === null ? null : await getPostCached(numeric);
  if (!post) return { title: '글을 찾을 수 없습니다', robots: { index: false } };
  const canonical = blogPostHref(post.id, post.slug);
  const description = post.summary ?? post.title;
  return {
    title: post.title,
    description,
    alternates: { canonical },
    // images 를 여기서 지정하지 않는다. 같은 폴더의 opengraph-image.tsx 가 글마다 카드를 그리고
    // Next 가 그 URL 과 크기를 넣어 준다. 여기에 적으면 명시값이 이겨서 파일 규약이 죽는다.
    // 다만 openGraph 객체 자체는 남겨야 한다 — Next 는 부모 openGraph 를 병합하지 않고 통째로 바꾼다.
    openGraph: {
      type: 'article',
      siteName: 'jay-blog',
      title: post.title,
      description,
      url: canonical,
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogPostPage({ params }: { readonly params: Promise<Params> }) {
  const { id, slug } = await params;
  const numeric = parseId(id);
  if (numeric === null) notFound();

  const post = await getPostCached(numeric);
  if (!post) notFound();

  // slug 는 읽기용이다. 제목이 바뀌어 slug 가 달라져도 정본 주소로 보낸다.
  if (decodeURIComponent(slug) !== post.slug) {
    permanentRedirect(blogPostHref(post.id, post.slug));
  }

  const [neighbors, sameCategory, comments] = await Promise.all([
    getBlogNeighbors(post.id),
    post.categorySlug ? getBlogPostsByCategory(post.categorySlug) : Promise.resolve([]),
    getBlogComments(post.id),
  ]);
  const others = sameCategory.filter((p) => p.id !== post.id).slice(0, 5);

  return (
    <BlogShell rail={<BlogRail active={post.categorySlug} />} title={post.title} category={post.categoryName}>
      <article className="blog-art">
        <header className="blog-art-head">
          <div className="blog-art-meta">
            {post.categorySlug && (
              <Link
                className="blog-chip"
                href={`/category/${encodeURIComponent(post.categorySlug)}`}
              >
                {post.categoryName}
              </Link>
            )}
            <span className="blog-dates">
              <span className="blog-date">
                <span className="lb">발행</span>
                <time dateTime={post.publishedAt}>{formatBlogDateTime(post.publishedAt)}</time>
              </span>
              {isEditedAfterPublish(post.publishedAt, post.updatedAt) && (
                <span className="blog-date">
                  <span className="lb">수정</span>
                  <time dateTime={post.updatedAt}>{formatBlogDateTime(post.updatedAt)}</time>
                </span>
              )}
            </span>
          </div>
          <h1>{post.title}</h1>
          {post.summary && <p className="sum">{post.summary}</p>}
        </header>

        <BlogSeriesNav prev={post.prevPost} next={post.nextPost} />

        {post.tocEnabled !== false && <BlogToc entries={extractToc(post.body)} />}

        <BlogArticleBody
          html={renderMarkdownPreview(post.body)}
          signal={`${post.id}:${post.publishedAt ?? ''}`}
        />

        {post.tags.length > 0 && (
          <div className="blog-art-tags">
            <span aria-hidden="true">#</span>
            <span className="sr-label">태그</span>
            {post.tags.map((tag) => (
              <Link key={tag} href={`/tag/${encodeURIComponent(tag)}`}>
                {tag}
              </Link>
            ))}
          </div>
        )}

        <nav className="blog-art-nav" aria-label="이전 다음 글">
          {neighbors.prev ? (
            <Link href={blogPostHref(neighbors.prev.id, neighbors.prev.slug)}>
              <span>← 이전 글</span>
              <b>{neighbors.prev.title}</b>
            </Link>
          ) : (
            <span />
          )}
          {neighbors.next && (
            <Link className="next" href={blogPostHref(neighbors.next.id, neighbors.next.slug)}>
              <span>다음 글 →</span>
              <b>{neighbors.next.title}</b>
            </Link>
          )}
        </nav>

        {others.length > 0 && (
          <section className="blog-samecat">
            <h2>
              &apos;<em>{post.categoryName}</em>&apos; 카테고리의 다른 글
            </h2>
            <ul>
              {others.map((other) => (
                <li key={other.id}>
                  <Link href={blogPostHref(other.id, other.slug)}>
                    <span className="t">{other.title}</span>
                    <span className="d">{formatBlogDate(other.publishedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <BlogComments postId={post.id} comments={comments} />
      </article>
    </BlogShell>
  );
}
