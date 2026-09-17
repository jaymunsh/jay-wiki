import { describe, expect, it } from 'vitest';

import {
  articleCountForCategoryGroup,
  categoryGroupForTab,
  tabsForCategoryGroup,
  WIKI_CATEGORY_GROUPS,
} from './wikiCategories';

const tabs = [
  { tabId: 'start', articles: [{}] },
  { tabId: 'backend', articles: [{}, {}] },
  { tabId: 'operations', articles: [{}, {}, {}] },
  { tabId: 'development-process', articles: [] },
  { tabId: 'verification', articles: [{}, {}] },
  { tabId: 'personal-projects', articles: [] },
  { tabId: 'team-projects', articles: [] },
  { tabId: 'tech-lab', articles: [] },
  { tabId: 'tools-workflow', articles: [] },
  { tabId: 'custom-project', articles: [{}, {}, {}] },
] as const;

describe('wiki category groups', () => {
  it('maps the current wiki tabs to their major category', () => {
    expect(categoryGroupForTab('backend')?.id).toBe('build');
    expect(categoryGroupForTab('operations')?.id).toBe('operate');
    expect(categoryGroupForTab('development-process')?.id).toBe('process');
    // 운영 검증은 운영이 아니라 개선이다. 히어로가 IMPROVE 를 '검증한 변화를 기록으로
    // 남긴다'로 선언하는데 이 탭이 OPERATE 에 있었다.
    expect(categoryGroupForTab('verification')?.id).toBe('process');
  });

  it('탭은 대시보드를 빼고 열 개다', () => {
    const all = WIKI_CATEGORY_GROUPS.flatMap((g) => g.tabIds);
    expect(all).toHaveLength(10);
    expect(new Set(all).size).toBe(10);
  });

  it('합쳐 없앤 탭은 어느 그룹에도 없다', () => {
    const all = WIKI_CATEGORY_GROUPS.flatMap((g) => g.tabIds);
    // governance·retrospective 는 주제가 아니라 글의 성격이라 지웠다. 성격 축은 첫 화면
    // 세그먼트(해결 기록 등)가 맡는다. 여기 남아 있으면 LAB 이 삼킨다 — 아래 테스트가 그것이다.
    for (const gone of ['observability', 'ai-usage', 'roadmap', 'governance', 'retrospective']) {
      expect(all).not.toContain(gone);
    }
  });

  it('places future unmapped tabs in Project Lab without swallowing Dashboard', () => {
    const lab = WIKI_CATEGORY_GROUPS.find((group) => group.id === 'lab');
    expect(lab).toBeDefined();
    if (!lab) return;

    expect(tabsForCategoryGroup(tabs, lab).map((tab) => tab.tabId)).toEqual([
      'personal-projects',
      'team-projects',
      'tech-lab',
      'tools-workflow',
      'custom-project',
    ]);
    expect(categoryGroupForTab('start')).toBeUndefined();
  });

  it('aggregates article counts for the major category badge', () => {
    const build = WIKI_CATEGORY_GROUPS.find((group) => group.id === 'build');
    expect(build).toBeDefined();
    if (!build) return;

    expect(articleCountForCategoryGroup(tabs, build)).toBe(2);
  });

  it('LAB 그룹은 자기 탭을 갖지 않고 블로그로만 보낸다', () => {
    const lab = WIKI_CATEGORY_GROUPS.find((g) => g.id === 'lab');
    expect(lab).toBeDefined();
    expect(lab?.tabIds).toEqual([]);
    expect(lab?.externalHref).toBeTruthy();
  });

  it('LAB 탭 id 는 어느 그룹에도 없다', () => {
    const all = WIKI_CATEGORY_GROUPS.flatMap((g) => g.tabIds);
    for (const gone of ['personal-projects', 'team-projects', 'tech-lab', 'tools-workflow']) {
      expect(all).not.toContain(gone);
    }
  });
});
