#!/usr/bin/env node
//
// 재실행해도 안전하다. 먼저 DB와 비교해 실제로 달라진 tab/article만 upsert하므로
// 무변경 재실행은 revision, version, updatedAt을 바꾸지 않는다. DB에만 남은 항목은 보고하되
// 자동 삭제하지 않는다. 관리자 화면에서 수정한 본문이 시드 원본과 다르면 변경 대상으로 표시된다.
//
//   node scripts/seed-portfolio-wiki.mjs
//   node scripts/seed-portfolio-wiki.mjs --dry-run
//   JAYWIKI_API_BASE=https://.../api/bff JAYWIKI_ADMIN_PASSWORD=... JAYWIKI_ADMIN_OTP=... node scripts/seed-portfolio-wiki.mjs --allow-remote-write
//   JAYWIKI_API_BASE=http://jaywiki.backend.svc.cluster.local:8080 JAYWIKI_INTERNAL_SYNC_TOKEN=... node scripts/seed-portfolio-wiki.mjs --allow-remote-write
//
import { loadWikiSource } from './lib/wiki-source.mjs';
import { cloudflareAccessHeaders } from './lib/cloudflare-access.mjs';

const API_BASE = (process.env.JAYWIKI_API_BASE ?? 'http://localhost:8080').replace(/\/+$/, '');
const ADMIN_USERNAME = process.env.JAYWIKI_ADMIN_USERNAME ?? 'admin';
const REVIEW_DATE = '2026-07-10';
const DRY_RUN = process.argv.includes('--dry-run');
const ALLOW_REMOTE_WRITE = process.argv.includes('--allow-remote-write');
const INTERNAL_SYNC_TOKEN = process.env.JAYWIKI_INTERNAL_SYNC_TOKEN?.trim() ?? '';
const SYNC_EDITOR = process.env.JAYWIKI_SYNC_EDITOR?.trim() || 'codex';
const ACCESS_HEADERS = cloudflareAccessHeaders(API_BASE);

// 로컬 백엔드가 아니면 기본 비밀번호를 쓰지 않는다.
// prod 백엔드는 AdminPasswordBootstrap 이 기본값 기동을 막지만, 시드 쪽에서도 막아둔다.
const isLocalTarget = /^https?:\/\/(?:admin\.)?(?:localhost|127\.0\.0\.1)(?::|\/|$)/.test(API_BASE);
const isHttpsTarget = API_BASE.startsWith('https://');
const targetHostname = new URL(API_BASE).hostname;
const isClusterServiceTarget =
  API_BASE.startsWith('http://') &&
  (targetHostname.endsWith('.svc') || targetHostname.endsWith('.svc.cluster.local'));
const ADMIN_PASSWORD = process.env.JAYWIKI_ADMIN_PASSWORD ?? (isLocalTarget ? 'admin1234' : '');
const ADMIN_OTP = process.env.JAYWIKI_ADMIN_OTP?.trim();
if (!isLocalTarget && !isHttpsTarget && !(isClusterServiceTarget && INTERNAL_SYNC_TOKEN)) {
  console.error(`non-local seed target must use HTTPS: ${API_BASE}`);
  process.exit(1);
}
if (!DRY_RUN && !isLocalTarget && !ALLOW_REMOTE_WRITE) {
  console.error('remote seed writes require --allow-remote-write after reviewing --dry-run output');
  process.exit(1);
}
if (!DRY_RUN && !ADMIN_PASSWORD && !INTERNAL_SYNC_TOKEN) {
  console.error(`admin credentials or an internal sync token are required when seeding: ${API_BASE}`);
  process.exit(1);
}

// 첫 화면 '핵심 위키' 다섯. 여기가 정본이다 -- 운영 화면(/admin/featured)에서 바꿔도
// 다음 반영에 이 목록으로 되돌아간다. 위키 본문과 같은 규칙으로 맞춘 것이다.
// 다섯 편까지고(서버가 센다), 여기 적은 slug 는 아래 articles 에 있어야 한다.
//
// 다섯 자리를 서로 다른 축으로 채운다 -- 배포, 백업, 보안, 관측, 아키텍처.
// saga-kafka-outbox-order 를 빼고 msa-data-ownership-split 을 넣었다. 둘 다 사가 영역이라
// 축이 겹쳤고, 소유권 글이 사가 글로 링크하므로 한 번만 더 누르면 닿는다.
const { featured, tabs, articles } = loadWikiSource();

function assertUniqueSlugs() {
  const seen = new Set();
  for (const article of articles) {
    if (seen.has(article.slug)) throw new Error(`duplicate slug: ${article.slug}`);
    seen.add(article.slug);
  }
  const tabIds = new Set(tabs.map((tab) => tab.tabId));
  for (const article of articles) {
    if (!tabIds.has(article.parentId)) {
      throw new Error(`article ${article.slug} points at unknown tab: ${article.parentId}`);
    }
  }
}

assertUniqueSlugs();
assertFeaturedExists();

let authCookie = '';

function apiUrl(path) {
  if (API_BASE.endsWith('/api/bff') && path.startsWith('/api/')) {
    return `${API_BASE}/${path.slice('/api/'.length)}`;
  }
  return `${API_BASE}${path}`;
}

// 없는 글을 대표로 걸면 서버가 400 을 준다. 파일 단계에서 먼저 잡는다.
function assertFeaturedExists() {
  const slugs = new Set(articles.map((article) => article.slug));
  for (const slug of featured) {
    if (!slugs.has(slug)) throw new Error(`featured article not in seed: ${slug}`);
  }
  if (new Set(featured).size !== featured.length) throw new Error('featured has a duplicate slug');
}

function writePath(path) {
  if (!INTERNAL_SYNC_TOKEN) return path;
  if (path === '/api/tabs') return '/internal/content-sync/tabs';
  if (path === '/api/articles') return '/internal/content-sync/articles';
  if (path.startsWith('/api/tabs/')) return `/internal/content-sync/tabs/${path.slice('/api/tabs/'.length)}`;
  if (path === '/api/wiki/featured') return '/internal/content-sync/featured';
  throw new Error(`unsupported internal sync path: ${path}`);
}

async function login() {
  if (INTERNAL_SYNC_TOKEN) return;
  const response = await fetch(apiUrl('/api/auth/admin-login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(API_BASE).origin, ...ACCESS_HEADERS },
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      ...(ADMIN_OTP ? { otp: ADMIN_OTP } : {}),
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`admin login failed: ${response.status} ${text}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('admin login did not return a Set-Cookie header');
  authCookie = setCookie.split(';')[0] ?? '';
}

async function waitForInternalSyncReady() {
  if (!INTERNAL_SYNC_TOKEN) return;

  const deadline = Date.now() + 60_000;
  let lastStatus = 'unreachable';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(apiUrl('/internal/content-sync/ready'), {
        headers: { 'x-content-sync-token': INTERNAL_SYNC_TOKEN, ...ACCESS_HEADERS },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status === 204) {
        console.log('Internal content sync endpoint is ready');
        return;
      }
      lastStatus = `HTTP ${response.status}`;
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`internal content sync endpoint did not become ready: ${lastStatus}`);
}

async function request(path, init) {
  const headers = {
    ...ACCESS_HEADERS,
    ...(init.headers ?? {}),
    ...(INTERNAL_SYNC_TOKEN
      ? { 'x-content-sync-token': INTERNAL_SYNC_TOKEN }
      : { cookie: authCookie, 'x-jaywiki-request': 'server', origin: new URL(API_BASE).origin }),
  };
  const targetPath = writePath(path);
  const response = await fetch(apiUrl(targetPath), { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${init.method ?? 'GET'} ${targetPath} failed: ${response.status} ${text}`);
  }
  return response;
}

async function readJson(path) {
  const response = await fetch(apiUrl(path), { cache: 'no-store', headers: ACCESS_HEADERS });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
}

function sameTab(current, desired) {
  return current?.title === desired.title && current?.sortOrder === desired.sortOrder;
}

function sameArticle(current, desired) {
  return (
    current?.parentId === desired.parentId &&
    current?.title === desired.title &&
    (current?.summary ?? null) === (desired.summary ?? null) &&
    current?.body === desired.body &&
    current?.kind === desired.kind &&
    (current?.tags ?? null) === (desired.tags ?? null) &&
    current?.status === desired.status &&
    (current?.lastReview ?? null) === (desired.lastReview ?? null) &&
    (current?.tocEnabled ?? false) === (desired.tocEnabled ?? false) &&
    current?.sortOrder === desired.sortOrder
  );
}

const desiredArticles = articles.map((article) => ({
  ...article,
  tocEnabled: article.tocEnabled ?? false,
  status: 'published',
  lastReview: article.lastReview ?? REVIEW_DATE,
  editor: SYNC_EDITOR,
}));
const currentTabs = (await readJson('/api/tabs')) ?? [];
const currentTabById = new Map(currentTabs.map((tab) => [tab.tabId, tab]));
const currentArticles = await Promise.all(
  desiredArticles.map((article) => readJson(`/api/articles/${encodeURIComponent(article.slug)}`)),
);
const currentFeatured = ((await readJson('/api/wiki/featured')) ?? []).map((a) => a.slug);
const featuredChanged = currentFeatured.join(',') !== featured.join(',');
const tabChanges = tabs.filter((tab) => !sameTab(currentTabById.get(tab.tabId), tab));
const articleChanges = desiredArticles.filter((article, index) => !sameArticle(currentArticles[index], article));
const desiredSlugs = new Set(desiredArticles.map((article) => article.slug));
const desiredTabIds = new Set(tabs.map((tab) => tab.tabId));
const extraTabs = currentTabs.filter((tab) => !desiredTabIds.has(tab.tabId));
const extraArticles = currentTabs
  .flatMap((tab) => tab.articles ?? [])
  .filter((article) => !desiredSlugs.has(article.slug));

for (const tab of tabChanges) {
  console.log(`[${currentTabById.has(tab.tabId) ? 'update' : 'create'}] tab ${tab.tabId}`);
}
for (const article of articleChanges) {
  const current = currentArticles[desiredArticles.indexOf(article)];
  console.log(`[${current ? 'update' : 'create'}] article ${article.slug}`);
}
for (const article of extraArticles) {
  console.log(`[extra] article ${article.slug} (not deleted)`);
}
// 빈 탭만 지운다. 글이 든 탭은 서버(TabService)도 409 로 거부하지만, 헛되이 부르지 않는다.
// 한 번에 둘까지만 — 시드 형식이 깨져 정본 탭 집합이 통째로 비면 가드가 있어도 여럿이 한꺼번에 날아간다.
const MAX_TAB_DELETES = 2;
const emptyExtraTabs = extraTabs.filter((tab) => (tab.articles ?? []).length === 0);
const tabDeletes = emptyExtraTabs.length > MAX_TAB_DELETES ? [] : emptyExtraTabs;

for (const tab of extraTabs) {
  const count = (tab.articles ?? []).length;
  if (count > 0) {
    console.log(`[extra] tab ${tab.tabId} — 글 ${count}편이 들어 있다 (not deleted)`);
  } else if (tabDeletes.length > 0) {
    console.log(`[delete] tab ${tab.tabId} (empty)`);
  } else {
    console.log(
      `[extra] tab ${tab.tabId} — 빈 탭이 ${emptyExtraTabs.length}개다. 한 번에 ${MAX_TAB_DELETES}개까지만 지운다 (not deleted)`,
    );
  }
}

if (featuredChanged) {
  console.log(`[update] featured  ${currentFeatured.join(' > ') || '(비어 있다)'}  ->  ${featured.join(' > ')}`);
}

if (DRY_RUN) {
  console.log(
    `Dry run: ${tabChanges.length} tab changes, ${articleChanges.length} article changes, ${tabDeletes.length} tab deletes, ${featuredChanged ? 1 : 0} featured changes, ${extraTabs.length + extraArticles.length} extras in ${API_BASE}`,
  );
} else if (tabChanges.length === 0 && articleChanges.length === 0 && tabDeletes.length === 0 && !featuredChanged) {
  console.log(`Already in sync: ${tabs.length} tabs and ${articles.length} articles in ${API_BASE}`);
} else {
  await login();
  await waitForInternalSyncReady();
  for (const tab of tabChanges) {
    await request('/api/tabs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tab),
    });
  }
  for (const article of articleChanges) {
    await request('/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(article),
    });
  }
  for (const tab of tabDeletes) {
    try {
      await request(`/api/tabs/${encodeURIComponent(tab.tabId)}`, { method: 'DELETE' });
      console.log(`Deleted empty tab ${tab.tabId}`);
    } catch (error) {
      // 그 사이에 글이 들어왔다는 뜻이다. 사람이 옮길 일이지 배포를 멈출 일은 아니다.
      if (!/failed: 409/.test(String(error))) throw error;
      console.warn(`Kept tab ${tab.tabId}: 서버가 거부했다(글이 들어 있다)`);
    }
  }
  // 글을 다 쓴 뒤에 부른다. 이 배포에서 처음 생기는 글을 대표로 걸면 앞에서는 아직 없다.
  if (featuredChanged) {
    await request('/api/wiki/featured', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slugs: featured }),
    });
    console.log(`Featured set to ${featured.join(' > ')}`);
  }
  console.log(
    `Synced ${tabChanges.length} tabs and ${articleChanges.length} articles into ${API_BASE}` +
      (tabDeletes.length > 0 ? `, deleted up to ${tabDeletes.length} empty tabs` : ''),
  );
}
