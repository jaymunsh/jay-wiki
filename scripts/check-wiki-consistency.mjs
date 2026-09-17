#!/usr/bin/env node
// 운영 위키와 시드가 어긋나는지 검사한다. 어긋나면 exit 1.
//
// 검사 셋:
//   1) 유령  — 운영에 있는데 시드에 없는 글
//   2) 고아  — 시드 글의 parentId 가 seedTabs 에 없는 것
//   3) 탭    — 운영 탭 집합이 wikiCategories 의 tabIds + start 와 같은지
//
// --seed-only 는 2번과, 시드↔wikiCategories 탭 대조만 돈다. 운영을 안 부르므로 CI 가 쓴다.
// 1번(유령)은 배포로만 지워지는 상태라 CI 에 걸면 배포 전 검사가 배포를 막는다 —
// 그건 사람이 배포 뒤에 돌린다(docs/deploy-runbook.md).
import fs from 'node:fs';
import { loadWikiSource } from './lib/wiki-source.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = process.env.JAYWIKI_PUBLIC_BASE ?? 'https://portfolio.leneu.cloud';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (jay-wiki consistency check)' };

const wiki = loadWikiSource();
const seedSlugs = new Set(wiki.articles.map(article => article.slug));
const seedParentIds = new Set(wiki.articles.map(article => article.parentId));
const seedTabs = new Set(wiki.tabs.map(tab => tab.tabId));

const categorySource = fs.readFileSync(
  path.join(root, 'web', 'src', 'lib', 'wikiCategories.ts'),
  'utf8',
);
const groupedTabs = new Set(
  [...categorySource.matchAll(/tabIds: \[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1])),
);

// 건전성 검사: 정규식이 형식 변경으로 조용히 빈 집합을 내지 않았는가.
// start 를 더한 뒤에 검사하면 크기가 0이 될 수 없어 이 검사가 죽는다.
if (groupedTabs.size === 0) {
  throw new Error('wikiCategories.ts 에서 tabIds 를 하나도 못 읽었다. 형식이 바뀌었는지 확인한다.');
}

// start 는 어느 대분류에도 안 들어가지만 유효한 탭이라 여기서 더한다.
groupedTabs.add('start');

// --seed-only: 저장소 안에서 끝나는 검사만. 운영을 안 부른다.
if (process.argv.includes('--seed-only')) {
  const local = [];
  for (const parentId of seedParentIds) {
    if (!seedTabs.has(parentId)) local.push(`고아: parentId '${parentId}' 가 seedTabs 에 없다`);
  }
  // 시드에 탭을 넣고 wikiCategories 에 안 넣으면 화면의 어느 대분류에도 안 걸린다.
  for (const tabId of seedTabs) {
    if (!groupedTabs.has(tabId)) local.push(`대분류에 없는 탭: ${tabId} (wikiCategories.ts 에 넣는다)`);
  }
  // 반대도 마찬가지다. 대분류만 남고 탭이 사라지면 빈 묶음이 그려진다.
  for (const tabId of groupedTabs) {
    if (tabId !== 'start' && !seedTabs.has(tabId)) local.push(`시드에 없는 탭: ${tabId} (wikiCategories.ts 에서 뺀다)`);
  }
  console.log(`시드 ${seedSlugs.size}편 / ${seedTabs.size}탭, 대분류에 묶인 탭 ${groupedTabs.size}`);
  if (local.length === 0) {
    console.log('시드 안에서 어긋난 곳이 없다. 운영 대조는 --seed-only 없이 돌린다.');
    process.exit(0);
  }
  for (const p of local) console.error(`  ${p}`);
  console.error(`\n${local.length}건 어긋났다.`);
  process.exit(1);
}

const res = await fetch(`${API_BASE}/api/bff/tabs`, { headers: HEADERS });
if (!res.ok) throw new Error(`tabs -> ${res.status}`);
let liveTabs;
try {
  liveTabs = await res.json();
} catch (e) {
  throw new Error(`운영 API 응답을 파싱하지 못했다: ${e.message}`);
}

// 거짓 통과 방지: 운영 데이터가 비어 있으면 실패
if (!Array.isArray(liveTabs) || liveTabs.length === 0) {
  throw new Error(`운영 탭을 못 읽었다 (배열 크기 0). 네트워크 문제인지 API 주소를 확인한다.`);
}
const liveCount = liveTabs.reduce((n, t) => n + (t.articles?.length ?? 0), 0);
if (liveCount === 0) {
  throw new Error(`운영 글을 못 읽었다 (글 수 0). 네트워크 문제인지 확인한다.`);
}

const problems = [];
let ghostArticleCount = 0;
let ghostTabCount = 0;
let ungroupedTabCount = 0;
let orphanCount = 0;

// 1) 유령 글 검사
for (const tab of liveTabs) {
  for (const article of tab.articles ?? []) {
    if (!seedSlugs.has(article.slug)) {
      problems.push(`유령 글: [${tab.tabId}] ${article.slug}`);
      ghostArticleCount++;
    }
  }
}

// 2) 유령 탭·대분류에 없는 탭 검사
for (const tab of liveTabs) {
  if (!seedTabs.has(tab.tabId)) {
    problems.push(`유령 탭: ${tab.tabId}`);
    ghostTabCount++;
  }
  if (!groupedTabs.has(tab.tabId)) {
    problems.push(`대분류에 없는 탭: ${tab.tabId}`);
    ungroupedTabCount++;
  }
}

// 3) 고아 검사: 시드의 parentId 가 seedTabs 에 없는 것
for (const parentId of seedParentIds) {
  if (!seedTabs.has(parentId)) {
    problems.push(`고아: parentId '${parentId}' 가 seedTabs 에 없다`);
    orphanCount++;
  }
}

console.log(`운영 ${liveCount}편 / ${liveTabs.length}탭, 시드 ${seedSlugs.size}편 / ${seedTabs.size}탭`);

if (problems.length === 0) {
  console.log('어긋난 곳이 없다.');
  process.exit(0);
}
for (const p of problems) console.error(`  ${p}`);
console.error(`\n유령 글 ${ghostArticleCount} / 유령 탭 ${ghostTabCount} / 대분류에 없는 탭 ${ungroupedTabCount} / 고아 ${orphanCount}, 총 ${problems.length}건 어긋났다.`);
process.exit(1);
