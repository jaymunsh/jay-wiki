#!/usr/bin/env node

import fs from 'node:fs';
import { loadWikiSource } from './lib/wiki-source.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, 'posts', 'jay-wiki');
const wiki = loadWikiSource();
const tabs = wiki.tabs;
// Preserve the historical export's removal of exactly one leading/trailing newline.
const articles = wiki.articles.map(article => ({ ...article, body: article.body.replace(/^\n/, '').replace(/\n$/, '') }));

const tabById = new Map(tabs.map((tab) => [tab.tabId, tab]));
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const tab of tabs) {
  fs.mkdirSync(path.join(outputRoot, `${String(tab.sortOrder).padStart(2, '0')}-${tab.tabId}`), { recursive: true });
}

for (const article of articles) {
  const tab = tabById.get(article.parentId);
  if (!tab) throw new Error(`Unknown parent tab: ${article.parentId}`);
  const directory = path.join(outputRoot, `${String(tab.sortOrder).padStart(2, '0')}-${tab.tabId}`);
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `slug: ${article.slug}`,
    `tab: ${JSON.stringify(tab.title)}`,
    `parentId: ${article.parentId}`,
    `sortOrder: ${article.sortOrder}`,
    `kind: ${article.kind}`,
    `tags: ${article.tags}`,
    'source: scripts/seed-portfolio-wiki.mjs',
    '---',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(directory, `${article.slug}.md`), `${frontmatter}${article.body.trim()}\n`);
}

for (const tab of tabs) {
  if (articles.some((article) => article.parentId === tab.tabId)) continue;
  const directory = path.join(outputRoot, `${String(tab.sortOrder).padStart(2, '0')}-${tab.tabId}`);
  fs.writeFileSync(
    path.join(directory, 'README.md'),
    `# ${tab.title}\n\n아직 공개된 문서가 없습니다. 이 디렉터리는 다음 위키 export에서도 유지됩니다.\n`,
  );
}

const index = [
  '# 위키 콘텐츠 Markdown export',
  '',
  '> 이 디렉터리는 `scripts/seed-portfolio-wiki.mjs`의 기준 콘텐츠를 읽기 좋은 Markdown 파일로 내보낸 결과다.',
  '',
  `- 생성 문서: ${articles.length}편`,
  `- 탭: ${tabs.length}개`,
  `- 생성 명령: \`node scripts/export-portfolio-wiki.mjs\``,
  '- 운영 DB에만 남아 있는 레거시 문서 17편은 이 export에 포함하지 않는다.',
  '- PostgreSQL은 운영 본문의 SoT이며, 이 파일은 검토·면접·백업용 콘텐츠 snapshot이다.',
  '',
  '## 탭',
  '',
  ...tabs.map((tab) => `- [${tab.title}](./${String(tab.sortOrder).padStart(2, '0')}-${tab.tabId}/) — ${articles.filter((article) => article.parentId === tab.tabId).length}편`),
  '',
].join('\n');
fs.writeFileSync(path.join(outputRoot, 'README.md'), index);
console.log(`Exported ${articles.length} articles across ${tabs.length} tabs to ${path.relative(root, outputRoot)}`);
