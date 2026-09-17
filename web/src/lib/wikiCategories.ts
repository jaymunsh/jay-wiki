import { BLOG_ORIGIN } from './blogLinks';

export type WikiCategoryGroup = {
  readonly id: 'build' | 'operate' | 'process' | 'lab';
  readonly code: 'BUILD' | 'OPERATE' | 'IMPROVE' | 'LAB';
  readonly title: string;
  readonly tabIds: readonly string[];
  readonly acceptsUnmapped?: boolean;
  /** 이 그룹의 글이 다른 사이트로 옮겨졌으면 그 주소. 대분류에서 카드 대신 링크로 낸다. */
  readonly externalHref?: string;
};

export type WikiTabRef = {
  readonly tabId: string;
  readonly articles: readonly unknown[];
};

export const DASHBOARD_TAB_ID = 'start';

export const WIKI_CATEGORY_GROUPS: readonly WikiCategoryGroup[] = [
  { id: 'build', code: 'BUILD', title: '구축', tabIds: ['infra', 'backend', 'data', 'frontend'] },
  {
    id: 'operate',
    code: 'OPERATE',
    title: '운영',
    // 관측(1편)을 운영에 접었다. 한 편짜리 탭은 탭이 아니다.
    // 운영 검증은 IMPROVE 로 보냈다 — 히어로가 IMPROVE 를 '검증한 변화를 기록으로 남긴다'로
    // 선언해 두고 정작 그 탭이 여기 있었다.
    tabIds: ['operations', 'demo', 'security'],
  },
  {
    id: 'process',
    code: 'IMPROVE',
    title: '개선',
    // 검증이 먼저다. 그룹 진입 링크가 첫 탭의 첫 글이라, 히어로 문장('검증한 변화를
    // 기록으로 남긴다')과 실제로 열리는 글이 같아진다.
    // 거버넌스(adr 4편)와 회고(7편)는 지웠다. 둘 다 주제가 아니라 글의 성격이었고,
    // 성격 축은 첫 화면 세그먼트(해결 기록 등)가 맡는다.
    // 개발 방식(디버깅·증거·AI)과 콘텐츠 품질(글 파이프라인·사실 검증·반입 기준)은
    // 같은 '개선'이지만 고치는 대상이 다르다. 하나로 두면 열 편이 한 덩어리로 뭉친다.
    tabIds: ['verification', 'development-process', 'content-quality'],
  },
  {
    id: 'lab',
    code: 'LAB',
    title: '프로젝트',
    // 이 그룹의 글은 blog.leneu.cloud 로 옮겼고 위키에서 지웠다(2026-08-10).
    // 그룹 자체는 지우지 않는다 — acceptsUnmapped 때문에 지우면 매핑되지 않은
    // 새 탭이 갈 곳을 잃는다.
    tabIds: [],
    acceptsUnmapped: true,
    externalHref: BLOG_ORIGIN,
  },
] as const;

const GROUPED_TAB_IDS: ReadonlySet<string> = new Set(
  WIKI_CATEGORY_GROUPS.flatMap((group) => group.tabIds),
);

export function categoryGroupForTab(tabId: string): WikiCategoryGroup | undefined {
  return WIKI_CATEGORY_GROUPS.find(
    (group) =>
      group.tabIds.includes(tabId) ||
      (group.acceptsUnmapped === true && tabId !== DASHBOARD_TAB_ID && !GROUPED_TAB_IDS.has(tabId)),
  );
}

export function tabsForCategoryGroup<T extends WikiTabRef>(
  tabs: readonly T[],
  group: WikiCategoryGroup,
): readonly T[] {
  return tabs.filter(
    (tab) =>
      group.tabIds.includes(tab.tabId) ||
      (group.acceptsUnmapped === true && tab.tabId !== DASHBOARD_TAB_ID && !GROUPED_TAB_IDS.has(tab.tabId)),
  );
}

export function articleCountForCategoryGroup(tabs: readonly WikiTabRef[], group: WikiCategoryGroup): number {
  return tabsForCategoryGroup(tabs, group).reduce((count, tab) => count + tab.articles.length, 0);
}
