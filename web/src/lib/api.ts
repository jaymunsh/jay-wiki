import 'server-only';
import { BACKEND_BASE as BASE } from './backend';
import { readAdminCookie } from './adminSession';

/**
 * Spring API 서버 클라이언트 (서버 컴포넌트/Server Action 전용).
 * 본문 SoT = PG 이므로 web 은 더 이상 MD 파일을 직접 읽지 않고 이 API 로 조회/저장한다.
 * - 클라이언트 컴포넌트는 직접 부르지 말고 BFF(/api/bff/*)를 통해야 함.
 */

export interface ArticleSummary {
  slug: string;
  parentId: string;
  title: string;
  summary?: string;
  kind: string;
  status: string;
  lastReview?: string;
  sortOrder: number;
  /** 조회수 (tb_article.view_count). 전체 조회수는 이 값을 트리에서 더해 낸다 */
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Article extends ArticleSummary {
  body: string;
  tags?: string;
  version: number;
  /** 목차 노출 (tb_article.toc_enabled). 세 줄 요약 아래에 ##/### 목차를 그린다 */
  tocEnabled?: boolean;
}

export interface Tab {
  tabId: string;
  title: string;
  sortOrder: number;
  articles: ArticleSummary[];
}

export interface Revision {
  version: number;
  title: string;
  body?: string;
  editor?: string;
  createdAt: string;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

/** 네비게이션 트리(탭 + 문서 요약). 홈/관리자 목록의 원천. */
export async function getTabs(): Promise<Tab[]> {
  try {
    return await get<Tab[]>('/api/tabs');
  } catch {
    return []; // 백엔드 미기동 시 빈 트리(사이트는 뜨되 안내)
  }
}

/**
 * 문서 단건(본문 포함). 없으면 null.
 *
 * view 는 조회수를 올릴지다. 사람이 그 글을 고른 경로에서만 true 를 준다 —
 * 관리자 편집 화면이나 첫 화면의 기본 글까지 세면 숫자가 뜻을 잃는다.
 * 인자를 원시값으로 두는 이유는 호출부가 react cache 로 memoize 하기 때문이다.
 * 객체를 넘기면 매번 다른 참조라 같은 요청에서 두 번 세어진다.
 *
 * clientIp 는 방문자의 주소다. 이 호출은 브라우저가 아니라 웹 서버가 하므로, 넘기지 않으면
 * Spring 이 보는 주소가 모든 방문자에게 똑같아진다 — 중복 제거가 전부를 한 사람으로 묶어
 * 하루에 한 명만 세어진다. 클라이언트 경로(BFF 프록시)는 이 헤더를 이미 넘기고 있다.
 *
 * referer 와 userAgent 도 같은 이유로 넘긴다. 안 넘기면 위키 유입이 전부 direct 로,
 * 디바이스가 전부 pc 로 쌓인다. 어느 쪽도 원문으로 저장되지 않는다 — referer 는 호스트만
 * 보고 소스 이름으로 줄이고, UA 는 모바일 여부 하나로 줄인다.
 */
export async function getArticle(
  slug: string,
  view = false,
  clientIp = '',
  referer = '',
  userAgent = '',
): Promise<Article | null> {
  const query = view ? '?view=true' : '';
  const headers: Record<string, string> = {};
  if (clientIp) headers['cf-connecting-ip'] = clientIp;
  if (referer) headers['referer'] = referer;
  if (userAgent) headers['user-agent'] = userAgent;
  const r = await fetch(`${BASE}/api/articles/${encodeURIComponent(slug)}${query}`, {
    cache: 'no-store',
    headers,
  });
  // 400 은 slug 가 형식을 어긴 것이다. 부르는 쪽에는 '그런 글이 없다' 와 같은 뜻이라
  // 404 처럼 다룬다. 던지면 주소를 잘못 친 방문자가 오류 화면을 본다.
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error(`getArticle ${slug} → ${r.status}`);
  return r.json();
}

/** 관리자 글 목록 = 트리를 평탄화. */
export async function listArticles(): Promise<(ArticleSummary & { tabTitle: string })[]> {
  const tabs = await getTabs();
  return tabs.flatMap((t) => t.articles.map((a) => ({ ...a, tabTitle: t.title })));
}

export async function getRevisions(slug: string): Promise<Revision[]> {
  try {
    const cookie = await readAdminCookie();
    const r = await fetch(`${BASE}/api/articles/${encodeURIComponent(slug)}/revisions`, {
      cache: 'no-store', headers: { cookie, 'x-jaywiki-request': 'server' },
    });
    if (!r.ok) return [];
    return r.json() as Promise<Revision[]>;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 게시판 (community.post/comment) — 워크북 04
// ---------------------------------------------------------------------------

export interface PostSummary {
  id: number;
  title: string;
  authorName: string;
  authorType: string;
  views: number;
  commentCount: number;
  createdAt: string;
}

export interface Post extends PostSummary {
  content: string;
  hasPassword: boolean;
}

export interface BoardComment {
  id: number;
  content: string;
  authorName: string;
  authorType: string;
  createdAt: string;
}

export interface AdminServiceStatus {
  readonly key: string;
  readonly title: string;
  readonly namespace: string;
  readonly kind: string;
  readonly name: string;
  readonly desiredReplicas: number;
  readonly currentReplicas: number;
  readonly minReplicas: number;
  readonly maxReplicas: number;
  readonly available: boolean;
  readonly description: string;
}

export interface PageResp<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** 게시글 목록(최신순 페이징). 백엔드 미기동 시 빈 페이지. */
export async function getPosts(page = 0, size = 20): Promise<PageResp<PostSummary>> {
  try {
    return await get<PageResp<PostSummary>>(`/api/board/posts?page=${page}&size=${size}`);
  } catch {
    return { content: [], page: 0, size, totalElements: 0, totalPages: 0 };
  }
}

/** 게시글 단건(본문 포함, 조회수 +1). 없으면 null. */
export async function getPost(id: string | number): Promise<Post | null> {
  const r = await fetch(`${BASE}/api/board/posts/${id}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`getPost ${id} → ${r.status}`);
  return r.json();
}

export async function getComments(id: string | number): Promise<BoardComment[]> {
  try {
    return await get<BoardComment[]>(`/api/board/posts/${id}/comments`);
  } catch {
    return [];
  }
}

/**
 * 관리자 조회는 쿠키를 실어야 한다. 예전에는 GET /api/** 가 공개라 안 실어도 됐지만,
 * /api/admin/** 를 닫으면서 인증 없는 서버 fetch 는 403 이 된다.
 *
 * 인증 실패는 던지고 그 밖의 실패만 빈 목록으로 삼킨다. 둘을 같이 삼키면
 * "로그인이 안 됐다" 와 "클러스터가 응답을 못 한다" 가 같은 빈 화면으로 보인다.
 */
export async function getAdminServices(): Promise<AdminServiceStatus[]> {
  const cookie = await readAdminCookie();
  const r = await fetch(`${BASE}/api/admin/services`, {
    cache: 'no-store',
    headers: { cookie, 'x-jaywiki-request': 'server' },
  });
  if (r.status === 401 || r.status === 403) {
    throw new Error(`admin services API → ${r.status} (관리자 인증이 없다)`);
  }
  if (!r.ok) return [];
  return r.json() as Promise<AdminServiceStatus[]>;
}

/**
 * 첫 화면 '대표 문서' 목록(V22). 공개 조회라 쿠키가 필요 없다.
 * 관리자 화면과 히어로가 같은 값을 본다 — 저장 뒤에 화면이 갈리지 않게 출처를 하나로 둔다.
 */
export async function getFeaturedArticles(): Promise<ArticleSummary[]> {
  const r = await fetch(`${BASE}/api/wiki/featured`, { cache: 'no-store' });
  if (!r.ok) return [];
  return r.json() as Promise<ArticleSummary[]>;
}
