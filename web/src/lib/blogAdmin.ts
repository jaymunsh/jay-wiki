import 'server-only';
import { BACKEND_BASE as BASE } from './backend';
import type { BlogCategory } from './blog';
import { readAdminCookie } from './adminSession';

/**
 * 관리 API 클라이언트 (서버 컴포넌트 전용).
 *
 * 공개용 lib/blog.ts 와 달리 반드시 jw_token 쿠키를 싣는다.
 * SecurityConfig 가 /api/admin/** 를 ADMIN 으로 묶기 때문이다.
 *
 * 실패를 삼키지 않고 던진다. 기존 getAdminServices 처럼 catch 로 빈 값을 돌려주면
 * 인증이 빠졌을 때 화면이 오류 없이 비어 보여서 알아채기 어렵다.
 */

export interface AdminBlogPost {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  body: string;
  categoryId: number;
  categorySlug?: string;
  categoryName?: string;
  coverAssetId?: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  updatedAt?: string;
  viewCount: number;
  /** 목차 노출 (tb_blog_post.toc_enabled) */
  tocEnabled: boolean;
  tags: string[];
  /** 시리즈 연결 (V31). 없으면 null 이다 */
  prevPostId?: number | null;
  nextPostId?: number | null;
}

export interface AdminBlogComment {
  id: number;
  postId: number;
  postTitle?: string;
  authorName: string;
  ipPrefix: string;
  body: string;
  createdAt: string;
  deletedAt?: string;
}

export interface DailyPoint {
  date: string;
  views: number;
  visitors: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

async function adminGet<T>(path: string): Promise<T> {
  const cookie = await readAdminCookie();
  const r = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: { cookie, 'x-jaywiki-request': 'server' },
  });
  if (!r.ok) throw new Error(`admin blog API ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export function getAdminBlogPosts(): Promise<AdminBlogPost[]> {
  return adminGet<AdminBlogPost[]>('/api/admin/blog/posts');
}

export function getAdminBlogPost(id: number): Promise<AdminBlogPost> {
  return adminGet<AdminBlogPost>(`/api/admin/blog/posts/${id}`);
}

export function getAdminBlogCategories(): Promise<BlogCategory[]> {
  return adminGet<BlogCategory[]>('/api/admin/blog/categories');
}

export function getAdminBlogComments(deleted = false): Promise<AdminBlogComment[]> {
  return adminGet<AdminBlogComment[]>(`/api/admin/blog/comments?deleted=${deleted}`);
}

/** 집계를 나눠 담는 사이트. 블로그와 위키가 같은 표를 이 값으로만 갈라 쓴다. */
export type StatsSite = 'blog' | 'wiki';

export interface SiteSummary {
  todayViews: number;
  yesterdayViews: number;
  totalViews: number;
  todayVisitors: number;
  yesterdayVisitors: number;
  totalVisitors: number;
  refSearch: number;
  refSns: number;
  /** 사이트 안에서의 이동. 밖에서 온 유입과 섞이지 않도록 따로 센다 */
  refInternal: number;
  refOther: number;
}

export function getStatsSummary(site: StatsSite): Promise<SiteSummary> {
  return adminGet<SiteSummary>(`/api/admin/stats/summary?site=${site}`);
}

export function getStatsDaily(site: StatsSite, days = 30): Promise<DailyPoint[]> {
  return adminGet<DailyPoint[]>(`/api/admin/stats/daily?site=${site}&days=${days}`);
}

export function getStatsReferrers(site: StatsSite, days = 30): Promise<SourceCount[]> {
  return adminGet<SourceCount[]>(`/api/admin/stats/referrers?site=${site}&days=${days}`);
}

export function getStatsDevices(site: StatsSite, days = 30): Promise<SourceCount[]> {
  return adminGet<SourceCount[]>(`/api/admin/stats/devices?site=${site}&days=${days}`);
}

/** 유입 소스별 댓글 수. 댓글은 블로그에만 있어 site 를 받지 않는다. */
export function getCommentSources(days = 30): Promise<SourceCount[]> {
  return adminGet<SourceCount[]>(`/api/admin/stats/comment-sources?days=${days}`);
}

/** 유입 소스별 가입 수. 계정은 사이트마다 나뉘지 않고 하나라 site 를 받지 않는다. */
export function getSignupSources(days = 30): Promise<SourceCount[]> {
  return adminGet<SourceCount[]>(`/api/admin/stats/signup-sources?days=${days}`);
}

export interface AnalyticsMetrics { views: number; visitors: number; sessions: number; engaged: number }
export interface AnalyticsDimension { title: string; label: string; views: number; sessions: number; engaged: number }
export interface AnalyticsReport {
  startedAt: string;
  current: AnalyticsMetrics;
  previous: AnalyticsMetrics;
  daily: (AnalyticsMetrics & { date: string })[];
  baseline: { throughDate: string; views: number; visitors: number };
  cumulative: { views: number; visitors: number };
  sources: AnalyticsDimension[];
  campaigns: AnalyticsDimension[];
  pages: AnalyticsDimension[];
  landings: AnalyticsDimension[];
  devices: AnalyticsDimension[];
}
export function getAnalyticsReport(site: StatsSite, days: number): Promise<AnalyticsReport> {
  return adminGet<AnalyticsReport>(`/api/admin/stats/report?site=${site}&days=${days}`);
}
