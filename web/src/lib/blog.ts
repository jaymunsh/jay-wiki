import 'server-only';
import { BACKEND_BASE as BASE } from './backend';
import { BLOG_PAGE_SIZE } from './blogPaging';

/**
 * 블로그 API 클라이언트 (서버 컴포넌트 전용).
 * 클라이언트 컴포넌트는 이걸 부르지 말고 BFF(/api/bff/blog/*)를 쓴다.
 * 백엔드가 죽어도 사이트가 통째로 500 이 되지 않도록 목록류는 빈 배열로 떨어진다.
 */

export interface BlogCategory {
  id: number;
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
  postCount: number;
  children: BlogCategory[];
}

export interface BlogPostSummary {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  categorySlug?: string;
  categoryName?: string;
  coverImageUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
}

/** 검색 결과 한 줄. 본문에서 걸린 자리(snippet)가 요약을 대신한다. */
export interface BlogSearchHit extends BlogPostSummary {
  snippet?: string;
}

export interface BlogPost extends BlogPostSummary {
  body: string;
  tags: string[];
  /** 목차 노출 (tb_blog_post.toc_enabled). 위키의 같은 이름 필드와 뜻이 같다 */
  tocEnabled?: boolean;
  /**
   * 글쓴이가 지정한 시리즈 연결 (V31). 아래의 BlogNeighbors 와 다르다 --
   * 그건 발행일 순서고 이건 이어서 쓴 글이다. 발행 전이거나 없으면 null 이다.
   */
  prevPost?: BlogPostSummary | null;
  nextPost?: BlogPostSummary | null;
}

export interface BlogNeighbors {
  prev: BlogPostSummary | null;
  next: BlogPostSummary | null;
}

export interface BlogTagCount {
  name: string;
  count: number;
}

export interface BlogComment {
  id: number;
  authorName: string;
  ipPrefix: string;
  body: string;
  createdAt: string;
}

export interface BlogStats {
  todayViews: number;
  yesterdayViews: number;
  totalViews: number;
  todayVisitors: number;
  yesterdayVisitors: number;
  totalVisitors: number;
  refSearch: number;
  refSns: number;
  /** 사이트 안에서의 이동. V32 부터 refOther 와 갈라진다 */
  refInternal: number;
  refOther: number;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`blog API ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

/** 목록류는 백엔드가 죽어도 화면이 뜨도록 빈 값으로 떨어진다. */
async function getOrEmpty<T>(path: string, fallback: T): Promise<T> {
  try {
    return await get<T>(path);
  } catch {
    return fallback;
  }
}

export function getBlogCategories(): Promise<BlogCategory[]> {
  return getOrEmpty<BlogCategory[]>('/api/blog/categories', []);
}

/**
 * 전체 목록. 페이지로 자르지 않는다 - 사이트맵이 모든 글의 주소를 필요로 하고,
 * 공유 카드가 조회수를 안 올리려고 여기서 글을 찾는다. 화면용 목록은 getBlogPostsPage 다.
 */
export function getBlogPosts(): Promise<BlogPostSummary[]> {
  return getOrEmpty<BlogPostSummary[]>('/api/blog/posts', []);
}

/** 서버가 잘라 준 한 페이지. 항목 타입만 다르고 껍데기는 검색과 같다. */
export interface BlogPage<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

/** 백엔드가 죽었을 때 화면이 그릴 빈 페이지. 0 페이지를 만들지 않는다. */
function emptyPage<T>(size: number): BlogPage<T> {
  return { items: [], page: 1, size, total: 0, totalPages: 1 };
}

/**
 * 화면이 쓰는 목록. 전체·카테고리·태그가 조건만 바꿔 같은 경로를 쓴다.
 * size 는 서버가 허용값(10·30·50) 밖이면 기본값으로 떨어뜨린다.
 */
export function getBlogPostsPage(query: {
  readonly category?: string;
  readonly tag?: string;
  readonly page?: number;
  readonly size?: number;
}): Promise<BlogPage<BlogPostSummary>> {
  const params = new URLSearchParams();
  if (query.category) params.set('category', query.category);
  if (query.tag) params.set('tag', query.tag);
  if (query.page) params.set('page', String(query.page));
  if (query.size) params.set('size', String(query.size));
  return getOrEmpty<BlogPage<BlogPostSummary>>(
    `/api/blog/posts/page?${params.toString()}`,
    emptyPage(query.size ?? BLOG_PAGE_SIZE),
  );
}

/** 검색의 페이지 판. 두 글자 미만이면 서버가 빈 1 페이지를 준다. */
export function searchBlogPostsPage(
  q: string,
  page = 1,
  size = BLOG_PAGE_SIZE,
): Promise<BlogPage<BlogSearchHit>> {
  const params = new URLSearchParams({ q, page: String(page), size: String(size) });
  return getOrEmpty<BlogPage<BlogSearchHit>>(
    `/api/blog/search/page?${params.toString()}`,
    emptyPage(size),
  );
}

export function getBlogPostsByCategory(slug: string): Promise<BlogPostSummary[]> {
  return getOrEmpty<BlogPostSummary[]>(
    `/api/blog/categories/${encodeURIComponent(slug)}/posts`,
    [],
  );
}

/**
 * 제목·요약·본문 검색. 본문에서 걸린 글에는 snippet 이 붙는다.
 * 두 글자 미만이면 서버가 빈 목록을 주므로 여기서 따로 막지 않는다.
 */
export function searchBlogPosts(q: string): Promise<BlogSearchHit[]> {
  return getOrEmpty<BlogSearchHit[]>(`/api/blog/search?q=${encodeURIComponent(q)}`, []);
}

export function getBlogPostsByTag(name: string): Promise<BlogPostSummary[]> {
  return getOrEmpty<BlogPostSummary[]>(`/api/blog/tags/${encodeURIComponent(name)}/posts`, []);
}

export function getBlogTags(): Promise<BlogTagCount[]> {
  return getOrEmpty<BlogTagCount[]>('/api/blog/tags', []);
}

export function getPopularBlogPosts(limit = 5): Promise<BlogPostSummary[]> {
  return getOrEmpty<BlogPostSummary[]>(`/api/blog/posts/popular?limit=${limit}`, []);
}

export function getBlogStats(): Promise<BlogStats | null> {
  return getOrEmpty<BlogStats | null>('/api/blog/stats', null);
}

export function getBlogComments(id: number): Promise<BlogComment[]> {
  return getOrEmpty<BlogComment[]>(`/api/blog/posts/${id}/comments`, []);
}

/** 글 단건. 없으면 null — 화면이 notFound() 를 부른다. */
export async function getBlogPost(id: number): Promise<BlogPost | null> {
  const r = await fetch(`${BASE}/api/blog/posts/${id}`, {
    cache: 'no-store',
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`getBlogPost ${id} → ${r.status}`);
  return r.json();
}

export function getBlogNeighbors(id: number): Promise<BlogNeighbors> {
  return getOrEmpty<BlogNeighbors>(`/api/blog/posts/${id}/neighbors`, { prev: null, next: null });
}
