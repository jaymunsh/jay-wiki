#!/usr/bin/env node
// 블로그 글 안의 내부 링크 `](/<id>/<slug>)` 가 실제 글을 가리키는지 검사한다. 어긋나면 exit 1.
//
// 왜 필요한가: 글 주소가 `/<id>/<slug>` 인데 id 는 DB 순번이라 로컬과 운영이 다르다.
// slug 만 맞고 id 가 틀리면 화면은 308 로 **다른 글**을 열어 준다. 오류가 아니라 조용한 오배송이라
// 눈으로는 안 걸린다. 실제로 orca 글의 donts3p 링크가 자기 자신으로 돌아오고 있었다.
//
// 검사 대상은 `drafts/` 다. 사람이 고치는 자리가 거기뿐이고, `posts/` 는 운영을 비추는
// 스냅샷이라 손으로 고칠 것이 아니다(재발행하면 동기화로 따라온다).
//
// id↔slug 대조표는 기본적으로 **저장소 안에서** 만든다. `posts/` 사본의 `source:` 줄에
// 운영 글 id 가 들어 있다. 운영 API 를 부르지 않는 이유는 하나다 — 운영이 집 미니PC 라
// 한 번 흔들리면 배포가 통째로 막힌다. 검사가 대상보다 잘 죽으면 검사가 아니다.
//
//   node scripts/check-blog-links.mjs
//   node scripts/check-blog-links.mjs --live                  # 운영 API 로 대조표를 만든다
//   node scripts/check-blog-links.mjs posts/jay-blog          # 사본까지 훑고 싶을 때
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.JAYWIKI_BLOG_API ?? 'https://portfolio.leneu.cloud/api/bff').replace(/\/+$/, '');

function markdownFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...markdownFiles(full));
    else if (name.endsWith('.md') && name !== 'README.md') out.push(full);
  }
  return out;
}

async function mapFromApi() {
  const res = await fetch(`${API}/blog/posts?size=200`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (jay-wiki blog link check)' },
  });
  if (!res.ok) throw new Error(`blog/posts -> ${res.status}`);
  const body = await res.json();
  const posts = Array.isArray(body) ? body : (body.content ?? []);
  return new Map(posts.map((p) => [String(p.id), p.slug]));
}

function mapFromRepo() {
  const map = new Map();
  for (const file of markdownFiles(path.join(root, 'posts', 'jay-blog', 'posts'))) {
    const text = readFileSync(file, 'utf8');
    const id = text.match(/^source: \S*\/blog\/posts\/(\d+)/m)?.[1];
    const slug = text.match(/^slug: (\S+)/m)?.[1];
    if (id && slug) map.set(id, slug);
  }
  return map;
}

const live = process.argv.includes('--live');
const slugById = live ? await mapFromApi() : mapFromRepo();
// 거짓 통과 방지: 대조표가 비면 모든 링크가 통과해 버린다.
if (slugById.size === 0) {
  throw new Error(
    live
      ? '발행 글을 못 읽었다 (0편). API 주소나 네트워크를 확인한다.'
      : 'posts/jay-blog/posts 에서 id↔slug 를 하나도 못 읽었다. source: 줄 형식이 바뀌었는지 본다.',
  );
}

const problems = [];
let checked = 0;
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const scanRoots = targets.length > 0 ? targets : [path.join('posts', 'jay-blog', 'drafts')];

for (const file of scanRoots.flatMap((r) => markdownFiles(path.join(root, r)))) {
  const text = readFileSync(file, 'utf8');
  for (const [, id, slug] of text.matchAll(/\]\(\/(\d+)\/([a-z0-9-]+)\)/g)) {
    checked++;
    const actual = slugById.get(id);
    const rel = path.relative(root, file);
    if (actual === undefined) problems.push(`${rel}: /${id}/${slug} — id ${id} 인 글이 없다`);
    else if (actual !== slug) problems.push(`${rel}: /${id}/${slug} — id ${id} 은 실제로 '${actual}' 이다`);
  }
}

console.log(`${live ? "운영 API" : "저장소 사본"} ${slugById.size}편 기준으로 내부 링크 ${checked}개를 검사했다.`);
if (problems.length === 0) {
  console.log('어긋난 링크가 없다.');
  process.exit(0);
}
for (const p of problems) console.error(`  ${p}`);
console.error(`\n${problems.length}건 어긋났다.`);
process.exit(1);
