#!/usr/bin/env node
// 운영 위키에만 있고 시드에 없는 글을 md 로 내려 posts/archive/ 에 둔다.
// 시드가 DB 를 자동 삭제하지 않아 쌓인 글들이고, posts/jay-wiki 에 사본이 없다.
// 지우기 전에 반드시 --write 로 한 번 돈다.
//
//   node scripts/archive-orphan-wiki-articles.mjs           목록만 본다
//   node scripts/archive-orphan-wiki-articles.mjs --write   파일로 쓴다
import fs from 'node:fs';
import { loadWikiSource } from './lib/wiki-source.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = process.env.JAYWIKI_PUBLIC_BASE ?? 'https://portfolio.leneu.cloud';
const OUT_DIR = path.join(root, 'posts', 'archive');
const WRITE = process.argv.includes('--write');

// Cloudflare 가 기본 UA 를 403 으로 막는다.
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (jay-wiki archive script)' };

function seedSlugs() { return new Set(loadWikiSource().articles.map(article => article.slug)); }

async function get(pathname) {
  const res = await fetch(`${API_BASE}${pathname}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${pathname} -> ${res.status}`);
  return res.json();
}

const seed = seedSlugs();
const tabs = await get('/api/bff/tabs');
const orphans = [];
for (const tab of tabs) {
  for (const article of tab.articles ?? []) {
    if (seed.has(article.slug)) continue;
    orphans.push({ tabId: tab.tabId, tabTitle: tab.title, ...article });
  }
}

if (orphans.length === 0) {
  console.log('운영에만 있는 글이 없다.');
  process.exit(0);
}

if (WRITE) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const orphan of orphans) {
  const full = await get(`/api/bff/articles/${encodeURIComponent(orphan.slug)}`);
  const body = full.body ?? '';
  const head = [
    '---',
    `slug: ${orphan.slug}`,
    `title: ${full.title ?? orphan.title}`,
    `tabId: ${orphan.tabId}`,
    `tabTitle: ${orphan.tabTitle}`,
    `updatedAt: ${full.updatedAt ?? orphan.updatedAt ?? ''}`,
    'note: 운영 DB 에만 있던 글이다. 시드에 정본이 없어 여기에 보관한다.',
    '---',
    '',
  ].join('\n');
  const file = path.join(OUT_DIR, `${orphan.slug}.md`);
  if (WRITE) fs.writeFileSync(file, head + body, 'utf8');
  console.log(`${WRITE ? 'write' : 'would write'} ${path.relative(root, file)} (${body.length}자)`);
}

console.log(`\n${orphans.length}편.${WRITE ? '' : ' --write 를 붙이면 실제로 쓴다.'}`);
