import type { MetadataRoute } from 'next';
import { getTabs } from '@/lib/api';
import { PUBLIC_SITE_ORIGIN } from '@/lib/siteConfig';
import { WIKI_CATEGORY_GROUPS } from '@/lib/wikiCategories';
import { SCENARIOS } from './scenarios/scenarios';

export const dynamic = 'force-dynamic'; // 위키 트리는 DB가 SoT

/** 사람이 직접 진입하는 공개 화면. admin·api·데모 보조 경로는 제외한다. */
const STATIC_PATHS = [
  '/',
  '/scenarios',
  '/monitoring',
  '/board',
  '/search',
  '/chat',
  '/saga/order',
  '/kafka/order',
  '/domain-scenarios/order-confirmation',
  '/domain-scenarios/gift-card',
  '/domain-scenarios/partner-api',
  '/domain-scenarios/traffic-burst',
] as const;

/** LAB 탭의 글은 블로그로 옮겨졌다. 위키 sitemap 에 남기면 죽은 주소를 내보내게 된다. */
const LAB_TAB_IDS: ReadonlySet<string> = new Set(
  WIKI_CATEGORY_GROUPS.find((group) => group.id === 'lab')?.tabIds ?? [],
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tabs = await getTabs(); // 백엔드 미기동 시 [] → 정적 경로만 노출
  const articles = tabs
    .filter((tab) => !LAB_TAB_IDS.has(tab.tabId))
    .flatMap((tab) => tab.articles)
    .filter((article) => article.status === 'published');

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${PUBLIC_SITE_ORIGIN}${path}` })),
    ...SCENARIOS.map((scenario) => ({ url: `${PUBLIC_SITE_ORIGIN}/scenarios/${scenario.id}` })),
    ...articles.map((article) => ({
      url: `${PUBLIC_SITE_ORIGIN}/wiki/${encodeURIComponent(article.slug)}`,
      lastModified: article.updatedAt ? new Date(article.updatedAt) : undefined,
    })),
  ];
}
