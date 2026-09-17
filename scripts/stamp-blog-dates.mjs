#!/usr/bin/env node
// 초안 머리말의 publishedAt 을 서버의 발행일과 맞춘다. slug 로 짝을 짓는다.
//
//   node scripts/stamp-blog-dates.mjs            # 무엇을 바꿀지 보여주기만 한다
//   node scripts/stamp-blog-dates.mjs --write    # 실제로 적는다
//   JAYWIKI_BLOG_API=http://localhost:8080/api node scripts/stamp-blog-dates.mjs --write
//
// 왜 필요한가: **배포는 miniPC 러너에서 돌아 이 맥의 로컬 API 를 못 읽는다.** 그래서 발행일을
// 로컬에서 실어 보낼 수가 없고, 새 글은 배포가 돈 시각으로 찍힌다(2026-08-25 에 8편이 그랬다).
// 저장소가 날짜를 들고 가야 클러스터까지 따라간다.
//
// 서버에는 아무것도 쓰지 않는다. 읽어서 초안 파일에만 적는다.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API = process.env.JAYWIKI_BLOG_API ?? 'https://portfolio.leneu.cloud/api/bff';
const DRAFT_DIR = process.env.BLOG_DRAFT_DIR ?? 'posts/jay-blog/drafts';
const write = process.argv.includes('--write');

async function serverDates() {
  const res = await fetch(`${API}/blog/posts?size=500`, {
    headers: { 'User-Agent': 'jay-wiki stamp-blog-dates' },
  });
  if (!res.ok) throw new Error(`${API} 가 ${res.status} 를 돌려줬다`);
  const body = await res.json();
  const rows = Array.isArray(body) ? body : (body.items ?? body.content);
  if (!Array.isArray(rows)) throw new Error(`${API} 응답에서 글 목록을 못 찾았다`);
  return new Map(rows.filter((p) => p.slug && p.publishedAt)
    .map((p) => [p.slug, { publishedAt: p.publishedAt, updatedAt: p.updatedAt ?? null }]));
}

/** 첫 `---` 위가 머리말이다. publish-blog-drafts.mjs 와 같은 규칙이다. */
function readHead(raw) {
  const at = raw.indexOf('\n---\n');
  if (at < 0) return null;
  const head = raw.slice(0, at);
  const slug = /^slug:\s*(.+)$/m.exec(head)?.[1]?.trim();
  const publishedAt = /^publishedAt:\s*(.+)$/m.exec(head)?.[1]?.trim();
  const updatedAt = /^updatedAt:\s*(.+)$/m.exec(head)?.[1]?.trim();
  return slug ? { at, head, slug, publishedAt, updatedAt } : null;
}

/** 머리말의 마지막 내용 줄 뒤에 끼워 넣는다. 끝의 빈 줄은 그대로 둔다 — 가이드가 보여주는 형식이다. */
function insertIntoHead(head, line) {
  const lines = head.split('\n');
  let last = lines.length - 1;
  while (last >= 0 && lines[last].trim() === '') last -= 1;
  lines.splice(last + 1, 0, line);
  return lines.join('\n');
}

const dates = await serverDates();
const files = (await readdir(DRAFT_DIR)).filter((f) => f.endsWith('.md')).map((f) => join(DRAFT_DIR, f));

let changed = 0;
let same = 0;
let missing = 0;
for (const file of files) {
  const raw = await readFile(file, 'utf8');
  const parsed = readHead(raw);
  if (!parsed) continue;
  const server = dates.get(parsed.slug);
  if (!server) {
    missing += 1;
    console.log(`  아직 서버에 없다  ${parsed.slug}`);
    continue;
  }
  if (parsed.publishedAt === server.publishedAt && parsed.updatedAt === server.updatedAt) {
    same += 1;
    continue;
  }
  changed += 1;
  console.log(`  ${parsed.publishedAt ?? '(없음)'} -> ${server.publishedAt}  ${parsed.slug}`);
  if (!write) continue;
  let head = parsed.publishedAt
    ? parsed.head.replace(/^publishedAt:.*$/m, `publishedAt: ${server.publishedAt}`)
    : insertIntoHead(parsed.head, `publishedAt: ${server.publishedAt}`);
  // 수정일도 저장소가 들고 가야 배포까지 따라간다. 배포는 러너에서 돌아 이 맥을 못 읽는다.
  if (server.updatedAt) {
    head = parsed.updatedAt
      ? head.replace(/^updatedAt:.*$/m, `updatedAt: ${server.updatedAt}`)
      : insertIntoHead(head, `updatedAt: ${server.updatedAt}`);
  }
  await writeFile(file, `${head}\n${raw.slice(parsed.at + 1)}`);
}

console.log(`${write ? '적었다' : 'dry-run'}: 바뀜 ${changed} / 그대로 ${same} / 서버에 없음 ${missing} (${API})`);
if (!write && changed) console.log('실제로 적으려면 --write 를 붙인다.');
