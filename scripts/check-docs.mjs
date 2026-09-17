#!/usr/bin/env node

import { loadWikiSource } from './lib/wiki-source.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ignoredDirectories = new Set(['.git', '.next', 'archive', 'leneu', 'node_modules', 'test-results']);

function collectMarkdown(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') && entry.name !== '.github') return [];
    if (ignoredDirectories.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectMarkdown(path);
    return extname(entry.name).toLowerCase() === '.md' ? [path] : [];
  });
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function localTarget(rawTarget, source) {
  let target = rawTarget.trim();
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
  if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(target)) return null;

  const withoutAnchor = target.split('#', 1)[0].split('?', 1)[0];
  if (!withoutAnchor) return null;

  try {
    return resolve(dirname(source), decodeURIComponent(withoutAnchor));
  } catch {
    return resolve(dirname(source), withoutAnchor);
  }
}

const failures = [];
const markdownFiles = collectMarkdown(root);
const markdownLink = /!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^)]*["'])?\)/g;

for (const file of markdownFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(markdownLink)) {
    const target = localTarget(match[1], file);
    if (!target || existsSync(target)) continue;
    failures.push(`${relative(root, file)}:${lineNumber(text, match.index)} -> missing ${relative(root, target)}`);
  }
}

const currentClaims = [
  {
    file: 'infra/README.md',
    pattern: /모든 워크로드는 `replicas: 1`/,
    reason: 'backend는 HPA로 평시 2 replicas를 사용한다',
  },
  {
    file: 'docs/current-project-status.md',
    pattern: /남은 것은 뜨지 않는 이미지로 재는/,
    reason: 'ImagePullBackOff 롤백 경로는 2026-08-19에 검증했다',
  },
  {
    file: 'docs/interview/06-프로젝트-설명-가이드.md',
    pattern: /로컬 기준은 4개 대분류, 18개 DB 탭과 39편/,
    reason: '현재 기준은 위키 86편·11개 탭이다',
  },
  {
    file: 'docs/interview/08-개선-리뷰.md',
    pattern: /\| 4 \| Google OAuth 실제 로그인 \|/,
    reason: 'Google OAuth는 2026-08에 제거했다',
  },
];

for (const claim of currentClaims) {
  const file = join(root, claim.file);
  const text = readFileSync(file, 'utf8');
  const match = claim.pattern.exec(text);
  if (match) failures.push(`${claim.file}:${lineNumber(text, match.index)} -> stale claim: ${claim.reason}`);
}

// The display and generated documentation share one report-derived snapshot.
const summary = JSON.parse(readFileSync(join(root, 'web/src/data/test-summary.json'), 'utf8'));
if (!Number.isInteger(summary.total) || summary.total !== summary.spring + summary.web) {
  failures.push('web/src/data/test-summary.json -> invalid test summary');
}

// 가이드북이 가리키는 위키 글이 실제로 시드에 있는지 본다. slug 는 개편 때 조용히 바뀌고,
// 그러면 책의 링크만 남아 404 로 간다 — 실제로 다섯 개가 그렇게 깨져 있었다.
{
  const guidebook = join(root, 'docs/interview/guidebook.html');
  const seedFile = join(root, 'scripts/seed-portfolio-wiki.mjs');
  if (existsSync(guidebook) && existsSync(seedFile)) {
    const slugs = new Set(loadWikiSource().articles.map(article => article.slug));
    const html = readFileSync(guidebook, 'utf8');
    for (const cited of new Set([...html.matchAll(/wiki\/([a-z0-9-]+)/g)].map((m) => m[1]))) {
      if (!slugs.has(cited)) {
        failures.push(`docs/interview/guidebook.html -> 위키에 없는 글을 가리킨다: ${cited}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Documentation check failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation check passed: ${markdownFiles.length} Markdown files, local links, current claims, and guidebook wiki links.`);
