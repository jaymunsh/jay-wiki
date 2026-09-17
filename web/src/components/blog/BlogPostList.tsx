import Link from 'next/link';
import type { BlogPostSummary, BlogSearchHit } from '@/lib/blog';
import { blogPostHref, formatBlogDate, isEditedAfterPublish } from '@/lib/blogLinks';

/**
 * 목록 한 줄 = 카테고리 / 제목 / 날짜 / 요약(2줄).
 * 대표 이미지가 있는 글만 우측에 156×117 썸네일이 붙고, 없으면 본문이 폭을 다 쓴다.
 * 목록에 태그는 넣지 않는다 — 태그 탐색은 좌측 레일이 맡는다.
 */
export function BlogPostList({ posts }: { readonly posts: readonly (BlogPostSummary | BlogSearchHit)[] }) {
  if (posts.length === 0) {
    return <p className="blog-empty">아직 글이 없습니다.</p>;
  }

  return (
    <div className="blog-posts">
      {posts.map((post) => (
        <Link
          key={post.id}
          className={post.coverImageUrl ? 'blog-post has-thumb' : 'blog-post'}
          href={blogPostHref(post.id, post.slug)}
        >
          {post.coverImageUrl && (
            <span className="blog-post-thumb">
              {/* 백엔드가 자산 id 든 본문 첫 이미지든 URL 로 풀어서 준다. 크기가 고정이라 next/image 가 필요없다. */}
              <img src={post.coverImageUrl} alt="" loading="lazy" />
            </span>
          )}
          <span className="blog-post-cat">{post.categoryName}</span>
          <span className="blog-post-title">{post.title}</span>
          <span className="blog-post-date blog-dates">
            <span className="blog-date">
              <span className="lb">발행</span>
              <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
            </span>
            {isEditedAfterPublish(post.publishedAt, post.updatedAt) && (
              <span className="blog-date">
                <span className="lb">수정</span>
                <time dateTime={post.updatedAt}>{formatBlogDate(post.updatedAt)}</time>
              </span>
            )}
          </span>
          {/* 검색 결과는 본문에서 걸린 자리를 요약 대신 보여 준다. 그래야 왜 걸렸는지 보인다. */}
          {('snippet' in post && post.snippet) || post.summary ? (
            <span className="blog-post-sum">
              {('snippet' in post && post.snippet) || post.summary}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
