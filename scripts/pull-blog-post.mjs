#!/usr/bin/env node
/**
 * 운영 블로그 글을 저장소로 내려받는다. publish-blog-drafts 의 반대 방향이다.
 *
 * 정본은 운영 DB 다(posts/jay-blog/README.md). 관리자 화면에서 고친 내용은 저장소로
 * 돌아오지 않아, 초안을 그대로 재발행하면 그 수정이 조용히 덮인다. 이 스크립트는
 * 덮기 전에 운영본을 받아 두거나, 로컬에서 같은 글을 보려고 쓴다.
 *
 * 조회는 공개 API 라 로그인이 필요 없다.
 *
 *   node scripts/pull-blog-post.mjs 17
 *   node scripts/pull-blog-post.mjs macbook-wifi-issue-when-moved --out posts/jay-blog/posts/tech-lab
 *   node scripts/pull-blog-post.mjs 17 --seed-local     # 로컬 DB 에도 같은 글을 넣는다
 *
 * --seed-local 은 로컬 관리자(admin/admin1234)로 로그인해 같은 slug 를 upsert 한다.
 * 로컬에만 쓴다. 운영에는 절대 쓰지 않는다 — 주소가 localhost 가 아니면 멈춘다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const REMOTE = (process.env.JAYWIKI_BLOG_API ?? 'https://portfolio.leneu.cloud/api/bff').replace(/\/+$/, '');
const LOCAL = (process.env.JAYWIKI_LOCAL_API ?? 'http://localhost:8080/api').replace(/\/+$/, '');
const LOCAL_PASSWORD = process.env.JAYWIKI_LOCAL_ADMIN_PASSWORD ?? 'admin1234';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const seedLocal = args.includes('--seed-local');
const givenOut = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const POST_HOME = 'posts/jay-blog/posts';

if (!target) {
  console.error('글 id 나 slug 를 준다. 예: node scripts/pull-blog-post.mjs 17');
  process.exit(1);
}

/** 머리말 값에 콜론이나 앞뒤 공백이 있으면 따옴표로 감싼다. 발행 스크립트가 벗겨 준다. */
function quote(value) {
  const text = String(value ?? '').trim();
  return /[:#]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

async function fetchPost() {
  const byId = /^\d+$/.test(target);
  if (byId) {
    const r = await fetch(`${REMOTE}/blog/posts/${target}`);
    if (!r.ok) throw new Error(`글을 못 받았다: ${r.status}`);
    return r.json();
  }
  const list = await (await fetch(`${REMOTE}/blog/posts?size=200`)).json();
  const items = Array.isArray(list) ? list : (list.items ?? list.content ?? []);
  const found = items.find((p) => p.slug === target);
  if (!found) throw new Error(`slug 를 찾을 수 없다: ${target}`);
  return (await fetch(`${REMOTE}/blog/posts/${found.id}`)).json();
}

async function seedIntoLocal(post) {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(LOCAL)) {
    throw new Error(`--seed-local 은 로컬 전용이다: ${LOCAL}`);
  }
  const jar = [];
  const call = async (path, init = {}) => {
    const r = await fetch(`${LOCAL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', cookie: jar.join('; '), 'x-jaywiki-request': 'server', ...(init.headers ?? {}) },
    });
    const setCookie = r.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) jar.push(c.split(';')[0]);
    if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  };

  await call('/auth/admin-login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: LOCAL_PASSWORD }) });

  const categories = [];
  const walk = (list) => list.forEach((c) => { categories.push(c); walk(c.children ?? []); });
  walk(await call('/admin/blog/categories'));
  let category = categories.find((c) => c.slug === post.categorySlug) ?? categories.find((c) => c.name === post.categoryName);
  // 운영에서 만든 카테고리가 로컬에 없을 수 있다. 글과 같은 이유로 한쪽으로만 흐르기 때문이다.
  if (!category) {
    category = await call('/admin/blog/categories', {
      method: 'POST',
      body: JSON.stringify({ slug: post.categorySlug, name: post.categoryName, parentId: null }),
    });
    console.log(`로컬  카테고리 생성  ${post.categorySlug} (${post.categoryName})`);
  }

  const existing = await call('/admin/blog/posts');
  const prev = existing.find((p) => p.slug === post.slug);
  const payload = {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    body: post.body,
    categoryId: category.id,
    coverAssetId: prev?.coverAssetId ?? null,
    status: 'published',
    publishedAt: post.publishedAt,
    tocEnabled: post.tocEnabled ?? true,
    tags: post.tags ?? [],
  };
  const saved = prev
    ? await call(`/admin/blog/posts/${prev.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await call('/admin/blog/posts', { method: 'POST', body: JSON.stringify(payload) });
  return saved;
}

/**
 * 이미 있는 저장소 사본의 자리를 찾는다. 사본은 분류 폴더(tech-lab, research ...) 아래에
 * 있는데 기본값은 그 위의 평평한 자리라, --out 을 잊으면 같은 slug 의 사본이 두 군데 생긴다
 * (2026-09-04 에 두 번 겪었다). 옛 사본이 남으므로 링크 검사가 옛 그림 주소를 정본으로 본다.
 */
function existingCopy(slug) {
  const stack = [POST_HOME];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(join(dir, entry.name));
      else if (entry.name === `${slug}.md`) return dir;
    }
  }
  return null;
}

const post = await fetchPost();
const outDir = givenOut ?? existingCopy(post.slug) ?? POST_HOME;
const file = join(outDir, `${post.slug}.md`);
const front = [
  '---',
  `title: ${quote(post.title)}`,
  `slug: ${post.slug}`,
  `category: ${quote(post.categoryName)}`,
  `summary: ${quote(post.summary)}`,
  `tags: ${(post.tags ?? []).join(',')}`,
  `toc: ${post.tocEnabled === false ? 'false' : 'true'}`,
  `source: ${REMOTE}/blog/posts/${post.id} (내려받음)`,
  '---',
  '',
].join('\n');

await mkdir(dirname(file), { recursive: true });
await writeFile(file, front + post.body.trim() + '\n', 'utf8');
console.log(`받음  ${post.slug}  ${post.body.length}자  →  ${file}`);
console.log(`      발행일 ${post.publishedAt} / 수정일 ${post.updatedAt}`);

if (seedLocal) {
  const saved = await seedIntoLocal(post);
  console.log(`로컬  id ${saved.id}  →  http://blog.localhost:3000/${saved.id}/${saved.slug}`);
}
