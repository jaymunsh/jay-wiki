'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { formatWikiListDate } from '@/lib/dateTime';
import { renderMarkdownPreview } from '@/lib/markdown';
import { isEdited } from '@/lib/recentEdits';
import {
  articleCountForCategoryGroup,
  categoryGroupForTab,
  DASHBOARD_TAB_ID,
  tabsForCategoryGroup,
  WIKI_CATEGORY_GROUPS,
  type WikiCategoryGroup,
} from '@/lib/wikiCategories';
import { MermaidDiagrams } from './MermaidDiagrams';
import { OrchestrationBoard } from './OrchestrationBoard';
import { Sparkline } from './Sparkline';

// sticky 헤더(.topbar) 높이. 글 머리가 이 아래로 들어가지 않게 여유를 둔다.
const HEADER_HEIGHT = 72;

// Spring API 의 트리 타입(서버에서 prop 으로 내려받음)
type ArticleSummary = {
  slug: string;
  parentId: string;
  title: string;
  summary?: string;
  kind: string;
  status: string;
  lastReview?: string;
  sortOrder: number;
  /** 조회수(V21). 전체 조회수는 이 값을 트리에서 더해 낸다 — 따로 저장하거나 묻지 않는다 */
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
};
type Mode = 'published' | 'edited' | 'featured' | 'viewed' | 'incident';
/** 되살릴 수 있는 탭. published 는 기본값이라 저장할 것이 없다. */
const RESTORABLE_MODES: readonly Mode[] = ['edited', 'featured', 'viewed', 'incident'];
type Tab = { tabId: string; title: string; sortOrder: number; articles: ArticleSummary[] };
type Article = ArticleSummary & { body: string; version: number; tocEnabled?: boolean };
type MeState = {
  readonly authenticated: boolean;
  readonly role?: string;
};

const HOME_PROOF_POINTS = [
  {
    id: '01',
    label: 'BUILD',
    groupId: 'build',
    title: '인프라를 서비스 환경으로 만든다',
    detail: '서버·네트워크·데이터까지 직접 구성',
  },
  {
    id: '02',
    label: 'OPERATE',
    groupId: 'operate',
    title: '배포 이후를 관측하고 대응한다',
    detail: '배포 상태와 서비스 신호로 원인 추적',
  },
  {
    id: '03',
    label: 'IMPROVE',
    groupId: 'process',
    title: '검증한 변화를 기록으로 남긴다',
    detail: '복구·성능·보안을 절차로 개선',
  },
] as const;

const ARTICLE_DATE_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * YYYY-MM-DD HH:MM (KST). sv-SE 로케일이 이 형식을 그대로 준다.
 * createdAt 은 V12 에서 시드 파일의 최초 커밋 날짜로 백필했고, updatedAt 은 시드가
 * 필드 diff 로 바뀐 글만 저장하므로 "본문이 마지막으로 바뀐 때"다.
 */
function formatArticleDate(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? '--' : ARTICLE_DATE_FORMATTER.format(timestamp);
}


/**
 * 1차/2차 탭 + 콘텐츠 영역.
 * 본문 SoT = DB → 트리(탭+요약)는 서버에서, 선택한 문서 본문은 BFF 로 on-demand fetch.
 */
export function WikiShell({
  tabs,
  initialArticle,
  deployedAt,
}: {
  tabs: Tab[];
  initialArticle: Article | null;
  /** 지금 도는 웹 프로세스의 기동 시각 = 이 버전이 운영에 반영된 시점. lib/deployedAt.ts 참고 */
  deployedAt?: string;
}) {
  const router = useRouter();
  const sorted = useMemo(() => [...tabs].sort((a, b) => a.sortOrder - b.sortOrder), [tabs]);
  const initialTabId =
    initialArticle && sorted.some((item) => item.tabId === initialArticle.parentId)
      ? initialArticle.parentId
      : sorted[0]?.tabId ?? '';
  const [tabId, setTabId] = useState(initialTabId);
  const revealPending = useRef(false);
  const tab = useMemo(() => sorted.find((t) => t.tabId === tabId) ?? sorted[0], [sorted, tabId]);
  /**
   * 무엇을 보고 있는지와, 그것을 조회수에 셀지를 한 값으로 든다.
   * 탭을 바꿔 첫 글이 딸려 오는 것은 고른 것이 아니라 세지 않고, 목록에서 고른 것만 센다.
   * 둘을 한 state 로 두면 본문 조회 effect 가 이 값 하나만 보면 되고, 따로 ref 를 나를 일이 없다.
   */
  const [selection, setSelection] = useState<{ readonly slug?: string; readonly count: boolean }>({
    slug: initialArticle?.slug ?? tab?.articles[0]?.slug,
    count: false,
  });
  const slug = selection.slug;
  const [me, setMe] = useState<MeState>({ authenticated: false });
  const isAdmin = me.authenticated && me.role === 'ADMIN';
  const groupEntryHrefs = useMemo(() => {
    const hrefs: Record<string, string> = {};
    for (const group of WIKI_CATEGORY_GROUPS) {
      const firstSlug = tabsForCategoryGroup(sorted, group).flatMap((t) => t.articles)[0]?.slug;
      if (firstSlug) hrefs[group.id] = `/wiki/${encodeURIComponent(firstSlug)}`;
    }
    return hrefs;
  }, [sorted]);
  // 히어로 우측의 '최근 발행'. 트리 prop 이 이미 전체 글 요약을 들고 있어 따로 부를 API 가 없다.
  const recent = useMemo(
    () =>
      sorted
        .flatMap((t) => t.articles)
        .filter((a) => a.createdAt)
        .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''))
        .slice(0, 5),
    [sorted],
  );
  /**
   * '최근 수정'. 발행 직후에는 updatedAt 이 createdAt 과 같으므로 그것만 떼어낸다.
   * 판정은 lib/recentEdits.ts 에 있다 — 문턱을 잘못 잡아 같은 날 고친 글이 통째로
   * 빠진 적이 있어 테스트로 고정했다.
   */
  const recentlyEdited = useMemo(
    () =>
      sorted
        .flatMap((t) => t.articles)
        .filter(isEdited)
        .sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? ''))
        .slice(0, 5),
    [sorted],
  );
  /**
   * '조회 순위'. 트리가 글마다 viewCount 를 이미 싣고 있어 부를 API 가 없다 — 총 조회수도 이 값을 더한 것이다.
   * 0회인 글은 뺀다. 아무도 안 본 글이 목록을 채우면 순위가 아니라 그냥 목록이 된다.
   */
  const mostViewed = useMemo(
    () =>
      sorted
        .flatMap((t) => t.articles)
        .filter((a) => (a.viewCount ?? 0) > 0)
        .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
        .slice(0, 5),
    [sorted],
  );
  /**
   * '해결 기록'. kind 가 postmortem 인 글만 최신순으로 낸다.
   * 이 사이트에서 제일 많이 파고드는 종류라 첫 화면에서 바로 닿게 둔다 —
   * 트리를 훑어 찾으려면 어느 탭에 있는지부터 알아야 한다.
   */
  const incidents = useMemo(
    () =>
      sorted
        .flatMap((t) => t.articles)
        .filter((a) => a.kind === 'postmortem')
        .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''))
        .slice(0, 5),
    [sorted],
  );
  useEffect(() => {
    if (!initialArticle) return;
    setTabId(initialArticle.parentId);
    setSelection({ slug: initialArticle.slug, count: false });
  }, [initialArticle]);

  // 목록은 1024px 이하에서 본문 아래로 내려간다. scroll: false 를 그대로 두면 글을 골라도
  // 화면이 앞 글의 끝에 머문다. 탭 줄 높이가 함께 바뀌므로 배치가 끝난 뒤(효과)에 재고,
  // 위로만 올린다 — 이미 글 머리 위에 있으면 탭 줄을 가리지 않는다.
  useEffect(() => {
    if (!revealPending.current) return;
    revealPending.current = false;
    const el = document.querySelector('.article');
    if (!el) return;
    // 문서 기준 좌표로 한 번에 옮긴다. 상대 이동(scrollBy)은 글이 짧아져 문서가 줄어든 만큼
    // 브라우저가 스크롤을 이미 깎은 뒤에 걸려 엉뚱한 곳에 선다.
    window.scrollTo({ top: Math.max(el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT, 0) });
  }, [tabId, selection.slug]);

  useEffect(() => {
    fetch('/api/bff/auth/me')
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((payload: MeState) => setMe({ authenticated: payload.authenticated === true, role: payload.role }))
      .catch(() => setMe({ authenticated: false }));
  }, []);

  // 글 머리가 이미 화면에 있으면(주로 데스크톱) 움직이지 않는다. 아래로 내려가 있을 때만 표시해 둔다.
  function markReveal() {
    const top = document.querySelector('.article')?.getBoundingClientRect().top;
    revealPending.current = top !== undefined && top < HEADER_HEIGHT;
  }

  function selectTab(id: string) {
    const next = sorted.find((t) => t.tabId === id) ?? sorted[0];
    const nextSlug = next?.articles[0]?.slug;
    setTabId(id);
    setSelection({ slug: nextSlug, count: false });
    markReveal();
    if (nextSlug) router.push(`/wiki/${encodeURIComponent(nextSlug)}`, { scroll: false });
  }

  function selectArticle(nextSlug: string) {
    setSelection({ slug: nextSlug, count: true });
    markReveal();
    router.push(`/wiki/${encodeURIComponent(nextSlug)}`, { scroll: false });
  }

  if (sorted.length === 0) {
    return (
      <div className="placeholder" style={{ marginTop: 24 }}>
        백엔드(jaywiki API)에 연결되지 않았거나 탭이 없습니다. Spring 을 <code>local</code> 프로파일로 띄우고
        새로고침하세요. (탭은 V2 마이그레이션이 7개 시드)
      </div>
    );
  }

  return (
    <>
      <Hero
        groupEntryHrefs={groupEntryHrefs}
        recent={recent}
        recentlyEdited={recentlyEdited}
        mostViewed={mostViewed}
        incidents={incidents}
        totalArticles={sorted.reduce((sum, t) => sum + t.articles.length, 0)}
        totalViews={sorted.reduce(
          (sum, t) => sum + t.articles.reduce((n, a) => n + (a.viewCount ?? 0), 0),
          0,
        )}
        deployedAt={deployedAt}
      />
      <PrimaryTabs items={sorted} active={tabId} isAdmin={isAdmin} onSelect={selectTab} />
      {slug === 'jaywiki-main-map' && <OrchestrationBoard />}
      <div className="content-grid">
        <ArticleView tab={tab} slug={slug} initialArticle={initialArticle} isAdmin={isAdmin} countView={selection.count} />
        <SidePanel tab={tab} slug={slug} onSelect={selectArticle} />
      </div>
    </>
  );
}

function Hero({
  groupEntryHrefs,
  recent,
  recentlyEdited,
  mostViewed,
  incidents,
  totalArticles,
  totalViews,
  deployedAt,
}: {
  readonly groupEntryHrefs: Record<string, string>;
  readonly recent: readonly ArticleSummary[];
  readonly recentlyEdited: readonly ArticleSummary[];
  readonly mostViewed: readonly ArticleSummary[];
  readonly incidents: readonly ArticleSummary[];
  readonly totalArticles: number;
  /** 트리가 이미 글별 조회수를 싣고 있어 더해서 낸다. 전체값을 따로 저장하거나 묻지 않는다 */
  readonly totalViews: number;
  readonly deployedAt?: string;
}) {
  return (
    <div className="home-top">
      <section className="home-hub" aria-labelledby="home-hub-title">
      <div className="home-hub-intro">
        {/* 반영 시각은 히어로 첫 줄 오른쪽에 둔다. '일자'라고 쓰지 않는 이유는 값이 분까지
            나오기 때문이고, '배포'라고 쓰지 않는 이유는 재기동으로도 갱신되기 때문이다
            (lib/deployedAt.ts). 지금 도는 것이 언제부터인지만 말한다. */}
        <div className="home-eyebrow-row">
          <div className="eyebrow">Wiki · Blog · Live Demo</div>
          {deployedAt && (
            <p className="home-synced">
              <span>최신 반영</span>
              <time dateTime={deployedAt}>{formatArticleDate(deployedAt)}</time>
            </p>
          )}
        </div>
        <h1 id="home-hub-title">
          <span className="home-title-line">Kubernetes 환경을</span>{' '}
          <span className="home-title-line"><span className="accent">직접 구축하고 운영</span>하며 기록하는</span>{' '}
          <span className="home-title-line">기술 실험실</span>
        </h1>
        <p>miniPC 한 대에 k3s를 올려 직접 운영하고, 장애와 복구를 다시 실행해 볼 수 있는 기록으로 남깁니다.</p>
        <div className="home-cta">
          <Link className="btn btn-primary" href="/saga/order">
            Saga 실패 시나리오 실행해보기 →
          </Link>
          <Link className="btn" href="/scenarios">
            시나리오 보기
          </Link>
        </div>
      </div>

      <div className="home-proof-list" aria-label="프로젝트 운영 흐름">
        {HOME_PROOF_POINTS.map((point) => {
          const href = groupEntryHrefs[point.groupId];
          const body = (
            <>
              <span>{point.id}</span>
              <div>
                <small>{point.label}</small>
                <strong>{point.title}</strong>
                <p>{point.detail}</p>
              </div>
            </>
          );
          return href ? (
            <Link className="home-proof" key={point.id} href={href} aria-label={`${point.label} 첫 문서 읽기`}>
              {body}
            </Link>
          ) : (
            <div className="home-proof" key={point.id}>
              {body}
            </div>
          );
        })}
      </div>
      </section>

      {/* 히어로 카드 안에 카드를 또 넣지 않는다. 아래 「이 카테고리의 문서」와 같은 열, 같은 카드 꼴이다. */}
      <div className="home-hub-side">
        <HeroOperations />
        {recent.length > 0 && (
          <RecentPanel
            recent={recent}
            recentlyEdited={recentlyEdited}
            mostViewed={mostViewed}
            incidents={incidents}
            totalArticles={totalArticles}
            totalViews={totalViews}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 최근 발행과 최근 수정을 한 카드에서 번갈아 본다. 고친 글을 찾으려고 탭을 훑을 필요가 없다.
 * 수정 목록이 비면 칸 자체를 안 그린다 - 빈 목록은 정보가 아니다.
 */
function RecentPanel({
  recent,
  recentlyEdited,
  mostViewed,
  incidents,
  totalArticles,
  totalViews,
}: {
  readonly recent: readonly ArticleSummary[];
  readonly recentlyEdited: readonly ArticleSummary[];
  readonly mostViewed: readonly ArticleSummary[];
  readonly incidents: readonly ArticleSummary[];
  readonly totalArticles: number;
  readonly totalViews: number;
}) {
  /**
   * 고른 탭을 sessionStorage 에 남긴다. 글을 하나 열었다 돌아올 때마다 '최근 발행' 으로
   * 되돌아가 있었다. localStorage 가 아닌 이유는 이게 취향이 아니라 지금 보는 방식이라서다 —
   * 브라우저를 닫으면 초기값으로 돌아가는 편이 맞다.
   * 첫 렌더는 서버와 같아야 하므로 값 복원은 그린 다음에 한다(하이드레이션 불일치 방지).
   */
  const [mode, setMode] = useState<Mode>('published');
  /**
   * '대표 문서'는 트리에 실려 오지 않는다. 첫 화면이 늘 지고 다닐 값이 아니라서
   * 탭을 누른 사람만 부른다. 한 번 받으면 그대로 들고 있는다.
   */
  const [featured, setFeatured] = useState<readonly ArticleSummary[] | null>(null);
  useEffect(() => {
    const saved = sessionStorage.getItem('jw-recent-mode');
    // 목록으로 쓴다. 값을 하나 더할 때마다 여기를 같이 고쳐야 하는데, 실제로 '조회 순위'를
    // 넣고 이 줄을 잊어 그 탭만 복원이 안 됐다.
    if (saved && saved !== 'published' && RESTORABLE_MODES.includes(saved as Mode)) setMode(saved as Mode);
  }, []);
  useEffect(() => {
    if (mode !== 'featured' || featured) return;
    fetch('/api/bff/wiki/featured')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ArticleSummary[]) => setFeatured(rows))
      .catch(() => setFeatured([]));
  }, [mode, featured]);
  function pick(next: Mode) {
    setMode(next);
    sessionStorage.setItem('jw-recent-mode', next);
  }
  const hasEdited = recentlyEdited.length > 0;
  const hasViewed = mostViewed.length > 0;
  /* 탭이 다섯이라 삼항으로 엮으면 읽히지 않는다. 칸이 비면 기본값(최근 발행)으로 떨어진다. */
  const listByMode: Record<Mode, readonly ArticleSummary[]> = {
    published: recent,
    edited: hasEdited ? recentlyEdited : recent,
    /* 아직 안 불렀거나(null) 운영에서 아무것도 안 고른 상태면 빈 칸 대신 기본 목록을 낸다.
       전시를 한 번도 지정하지 않은 배포 직후가 그 상태다. */
    featured: featured?.length ? featured : recent,
    viewed: hasViewed ? mostViewed : recent,
    incident: incidents.length > 0 ? incidents : recent,
  };
  const items = listByMode[mode];
  return (
    <div className="home-recent" aria-labelledby="home-recent-title">
      <div className="home-recent-head">
        {/* 위 TRAFFIC 카드와 같은 자리·같은 꼴의 이름표. 없으면 왼쪽이 비어 두 카드가 어긋나 보인다.
            LAB 탭과 같은 화살표를 달아 여기서 전체 목록으로 나간다. */}
        <Link className="home-recent-label" href="/wiki">DOCS ↗</Link>
        {/* 숫자 하나에 카드 한 장을 쓰지 않는다. 총 조회수를 여기로 합쳐 카드를 하나 줄였다. */}
        <span>
          글 <strong>{totalArticles}</strong>
          {totalViews > 0 && <> · 조회 <strong>{totalViews.toLocaleString('ko-KR')}</strong></>}
        </span>
        <h2 className="home-recent-tabs" id="home-recent-title">
          <button aria-pressed={mode === 'published'} onClick={() => pick('published')} type="button">
            최근 발행
          </button>
          {hasEdited && (
            <button aria-pressed={mode === 'edited'} onClick={() => pick('edited')} type="button">
              최근 수정
            </button>
          )}
          <button aria-pressed={mode === 'featured'} onClick={() => pick('featured')} type="button">
            대표 문서
          </button>
          {incidents.length > 0 && (
            <button aria-pressed={mode === 'incident'} onClick={() => pick('incident')} type="button">
              해결 기록
            </button>
          )}
          {/* 아무도 안 본 상태에서는 칸 자체를 안 그린다. 0회 목록은 순위가 아니라 그냥 목록이다. */}
          {hasViewed && (
            <button aria-pressed={mode === 'viewed'} onClick={() => pick('viewed')} type="button">
              조회 순위
            </button>
          )}
        </h2>
      </div>
      <ul>
        {items.map((a) => {
          const stamp = mode === 'edited' ? a.updatedAt : a.createdAt;
          return (
            <li key={a.slug}>
              <Link href={`/wiki/${encodeURIComponent(a.slug)}`}>
                <span>{a.title}</span>
                {/* 순위 목록에서 오른쪽 칸은 날짜가 아니라 그 순위를 만든 값이어야 한다. */}
                {mode === 'viewed' ? (
                  <em>{(a.viewCount ?? 0).toLocaleString('ko-KR')}</em>
                ) : (
                  <time dateTime={stamp}>{formatWikiListDate(stamp)}</time>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type HeroOpsSnapshot = {
  readonly source: string;
  readonly updatedAt: string;
  readonly traffic: {
    readonly requestsPerSecond: number | null;
    readonly p95Milliseconds: number | null;
    readonly points: readonly number[];
  };
  readonly runtime: {
    readonly nodeReady: boolean | null;
    readonly runningPods: number | null;
    readonly cpuUsage: number | null;
    readonly memoryUsage: number | null;
    readonly diskUsage: number | null;
  };
};

/** 0~1 비율을 정수 퍼센트로. 값이 없으면 '—'. */
function percent(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)}%`;
}

/**
 * 히어로가 "miniPC 한 대로 직접 운영한다"고 주장하는 자리 옆에 그 근거를 놓는다.
 *
 * /monitoring 과 달리 폴링하지 않는다 — 히어로는 오래 열어두는 화면이라 15초마다 치면 안 된다.
 * 값을 못 받으면 '--' 를 늘어놓지 않고 블록째 감춘다. 낡은 스냅샷일 수 있어 측정 시각을 같이 적는다.
 *
 * 히어로는 글 페이지에도 렌더되므로 페이지를 열 때마다 한 번씩 부른다.
 * ponytail: 조회당 1회, 캐시 없음. 트래픽이 늘면 /api/operations 에 짧은 revalidate 를 건다.
 */
function HeroOperations() {
  const [snapshot, setSnapshot] = useState<HeroOpsSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/operations', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: HeroOpsSnapshot | null) => {
        if (!alive) return;
        if (payload && payload.source !== 'unavailable') setSnapshot(payload);
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const nodeReady = snapshot?.runtime.nodeReady ?? null;
  const runningPods = snapshot?.runtime.runningPods ?? null;
  const p95 = snapshot?.traffic.p95Milliseconds ?? null;
  const rps = snapshot?.traffic.requestsPerSecond ?? null;
  const cpuUsage = snapshot?.runtime.cpuUsage ?? null;
  const memoryUsage = snapshot?.runtime.memoryUsage ?? null;
  const diskUsage = snapshot?.runtime.diskUsage ?? null;
  const empty = snapshot !== null && nodeReady === null && runningPods === null && p95 === null;

  if (failed || empty) return null;

  return (
    <Link className={`home-ops${snapshot === null ? ' is-loading' : ''}`} href="/monitoring" aria-label="모니터링 화면 열기" aria-busy={snapshot === null}>
      {/* 값이 없어도 줄은 항상 그린다. 조건부로 감추면 응답이 온 순간 카드가 늘어나 화면이 밀린다. */}
      <div className="home-ops-line home-ops-head-line">
        <span className="home-ops-label">TRAFFIC ↗</span>
        {/* 콜론을 뺀다. 이 줄은 360px 고정 카드 안에서 폭이 자라지 않는데,
            CPU·RAM 이 100% 가 되면 콜론 넷을 단 채로는 넘친다. 구분자가 이미 짝을 가른다. */}
        <span className="home-ops-values">
          PODS {runningPods ?? '—'}
          <span className="home-ops-sep">|</span>
          CPU {percent(cpuUsage)}
          <span className="home-ops-sep">|</span>
          RAM {percent(memoryUsage)}
          <span className="home-ops-sep">|</span>
          DISK {percent(diskUsage)}
        </span>
      </div>
      {/* 그래프는 라벨 줄 아래를 통째로 깐다. 시각·req/s 는 그 위에 가운데로 얹는다.
          0 기준을 유지한다 — 구간 최소~최대로 바꾸면 점 하나 차이가 절벽처럼 과장돼
          트래픽이 폭락한 것처럼 보인다. */}
      {/* 카드 전체가 링크라 여기서 또 링크를 두면 a 가 a 를 품는다. 그래프는 자리만 잡는다. */}
      <div className="home-ops-band">
        {snapshot === null ? (
          <div className="operations-plot" />
        ) : (
          <Sparkline points={snapshot.traffic.points} label="최근 30분 요청률 추이" />
        )}
      </div>
      <p className="home-ops-line home-ops-values home-ops-footer">
        {snapshot === null ? (
          '불러오는 중…'
        ) : (
          <>
            <time dateTime={snapshot.updatedAt}>{formatArticleDate(snapshot.updatedAt)}</time> 기준
          </>
        )}
        <span className="home-ops-sep">|</span>
        <strong>{rps === null ? '—' : rps.toFixed(2)} req/s</strong>
      </p>
    </Link>
  );
}

function PrimaryTabs({
  items,
  active,
  isAdmin,
  onSelect,
}: {
  readonly items: readonly Tab[];
  readonly active: string;
  readonly isAdmin: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const dashboard = items.find((item) => item.tabId === DASHBOARD_TAB_ID);
  const activeGroup = categoryGroupForTab(active);
  const secondaryTabs = activeGroup ? tabsForCategoryGroup(items, activeGroup) : [];

  function selectGroup(group: WikiCategoryGroup) {
    const firstTab = tabsForCategoryGroup(items, group)[0];
    if (firstTab) onSelect(firstTab.tabId);
  }

  return (
    <div className="tabs-primary-wrap">
      <nav className="tabs-primary" aria-label="대분류 카테고리">
        {dashboard && (
          <button
            type="button"
            className={dashboard.tabId === active ? 'active' : ''}
            aria-current={dashboard.tabId === active ? 'page' : undefined}
            onClick={() => onSelect(dashboard.tabId)}
          >
            <span className="tabs-major-code">DASHBOARD</span>
            <span className="tabs-major-title">지도</span>
          </button>
        )}
        {WIKI_CATEGORY_GROUPS.map((group) => {
          const count = articleCountForCategoryGroup(items, group);
          // 글이 다른 사이트로 옮겨진 그룹(LAB)은 탭을 펼치지 않고 그 사이트로 보낸다.
          if (group.externalHref) {
            return (
              <a key={group.id} href={group.externalHref}>
                <span className="tabs-major-code">{group.code}</span>
                <span className="tabs-major-title">{group.title} ↗</span>
              </a>
            );
          }
          return (
            <button
              key={group.id}
              type="button"
              className={activeGroup?.id === group.id ? 'active' : ''}
              aria-pressed={activeGroup?.id === group.id}
              onClick={() => selectGroup(group)}
            >
              <span className="tabs-major-code">{group.code}</span>
              <span className="tabs-major-title">{group.title}</span>
              {count > 0 && <span className="num">{count}</span>}
            </button>
          );
        })}
        {isAdmin && (
          <>
            <Link className="tab-admin" href="/admin/tabs" title="탭 관리">⚙</Link>
            <Link className="tab-admin" href="/admin/articles/new" title="새 글">＋</Link>
          </>
        )}
      </nav>
      {activeGroup && secondaryTabs.length > 0 && (
        <nav className="tabs-secondary" aria-label={`${activeGroup.title} 소분류`}>
          {secondaryTabs.map((tab) => (
            <button
              key={tab.tabId}
              type="button"
              className={tab.tabId === active ? 'active' : ''}
              aria-current={tab.tabId === active ? 'page' : undefined}
              onClick={() => onSelect(tab.tabId)}
            >
              {tab.title}
              <span className="num">{tab.articles.length}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function ArticleView({
  tab,
  slug,
  initialArticle,
  isAdmin,
  countView,
}: {
  readonly tab?: Tab;
  readonly slug?: string;
  readonly initialArticle: Article | null;
  readonly isAdmin: boolean;
  /** 이 조회를 조회수에 셀지. 목록에서 고른 것만 true 다 */
  readonly countView: boolean;
}) {
  const [article, setArticle] = useState<Article | null>(
    initialArticle?.slug === slug ? initialArticle : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) {
      setArticle(null);
      setLoading(false);
      return;
    }
    if (initialArticle?.slug === slug) {
      setArticle((current) =>
        current?.slug === initialArticle.slug && current.version === initialArticle.version ? current : initialArticle
      );
      setLoading(false);
      return;
    }
    let ignore = false;
    setLoading(true);
    const query = countView ? '?view=true' : '';
    fetch(`/api/bff/articles/${encodeURIComponent(slug)}${query}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((nextArticle: Article | null) => {
        if (!ignore) setArticle(nextArticle);
      })
      .catch(() => {
        if (!ignore) setArticle(null);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [initialArticle, slug, countView]);

  if (!slug) {
    return (
      <article className="article">
        <div className="placeholder">
          이 카테고리에 글이 없습니다.
          {isAdmin && (
            <>
              {' '}
              <Link href={`/admin/articles/new?parentId=${tab?.tabId ?? 'start'}`}>지금 작성 →</Link>
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="article" id={slug} aria-busy={loading}>
      <header className="article-head">
        <div className="article-head-main">
          {/* 상태·버전 배지는 crumb 과 같은 줄에 선다. 오른쪽 위에 따로 세우면 제목 폭을 깎고
              날짜와 묶여 한 덩어리로 읽힌다 — 셋은 성격이 다르다. */}
          <div className="article-crumb-line">
            <div className="crumb"><b>{tab?.title.replace(/^\d+\.\s*/, '')}</b> · {article?.title ?? slug}</div>
            {article && (
              <div className="badge-row">
                <span className={`badge ${article.status === 'published' ? 'green' : ''}`}>● {article.status}</span>
                <span className="badge kind">v{article.version}</span>
              </div>
            )}
          </div>
          <h1>{article?.title ?? slug}</h1>
          {article?.summary && <p className="desc">{article.summary}</p>}
          {article && (article.createdAt || article.updatedAt) && (
            <dl className="article-dates">
              {article.createdAt && (
                <>
                  <dt>발행</dt>
                  <dd><time dateTime={article.createdAt}>{formatArticleDate(article.createdAt)}</time></dd>
                </>
              )}
              {article.updatedAt && (
                <>
                  <dt>수정</dt>
                  <dd><time dateTime={article.updatedAt}>{formatArticleDate(article.updatedAt)}</time></dd>
                </>
              )}
              {/* 같은 사람이 하루에 여러 번 열어도 한 번만 오른다. 탭을 바꿔 딸려 온 것은 안 센다. */}
              {article.viewCount !== undefined && (
                <>
                  <dt>조회</dt>
                  <dd>{article.viewCount.toLocaleString('ko-KR')}</dd>
                </>
              )}
            </dl>
          )}
        </div>
        {isAdmin && (
          <div className="article-meta-actions">
            <div className="article-admin-actions" aria-label="관리자 문서 명령">
              <Link className="badge" href={`/admin/articles/new?parentId=${tab?.tabId}&slug=${slug}`}>✎ 편집</Link>
              <Link className="badge" href={`/admin/articles/${slug}/revisions`}>🕒 이력</Link>
            </div>
          </div>
        )}
      </header>
      {/* 불러오는 동안 본문을 지우지 않는다. 지우면 문서 높이가 통째로 무너져(13543 → 1187)
          브라우저가 스크롤을 최대치로 깎고, 본문이 돌아와도 그만큼 안 돌아온다 —
          탭을 바꿀 때마다 화면이 조금씩 올라가던 것이 이것이다. 앞 글을 그대로 두고 갈아끼운다. */}
      {article ? (
        <ArticleBody article={article} />
      ) : loading ? (
        <div className="placeholder">불러오는 중…</div>
      ) : (
        <div className="placeholder">문서를 찾을 수 없습니다.</div>
      )}
    </article>
  );
}

const ArticleBody = memo(function ArticleBody({ article }: { readonly article: Article }) {
  const proseRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div ref={proseRef} className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(article.body, { toc: article.tocEnabled }) }} />
      <MermaidDiagrams scopeRef={proseRef} signal={`${article.slug}:${article.version}`} />
    </>
  );
});

function SidePanel({ tab, slug, onSelect }: { tab?: Tab; slug?: string; onSelect: (s: string) => void }) {
  return (
    <aside>
      <div className="side">
        <div className="side-head">
          <h3>이 카테고리의 문서</h3>
          <span>{tab?.articles.length ?? 0}</span>
        </div>
        <ul className="side-doc-list">
          {(tab?.articles ?? []).map((a) => (
            <li key={a.slug}>
              <button type="button" className={a.slug === slug ? 'active' : ''} onClick={() => onSelect(a.slug)}>
                <span>{a.title}</span>
                <time dateTime={a.createdAt}>{formatWikiListDate(a.createdAt)}</time>
              </button>
            </li>
          ))}
          {(tab?.articles.length ?? 0) === 0 && <li><small>아직 없음</small></li>}
        </ul>
      </div>
    </aside>
  );
}
