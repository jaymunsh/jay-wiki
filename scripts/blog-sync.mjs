#!/usr/bin/env node
// 블로그 한 방 맞춤. 로컬과 운영의 차이를 보고, 양쪽을 한 번에 맞춘다.
//
//   node scripts/blog-sync.mjs             # 무엇을 어느 방향으로 옮길지 보여주기만 한다
//   node scripts/blog-sync.mjs --write     # 실제로 옮긴다
//
// 왜 필요한가: 지금까지는 명령이 셋이었다. 차이를 보려면 check-content-sync, 올리려면
// publish-blog-post, 내리려면 sync-local-from-prod 다. 어느 것을 언제 쓰는지는 사람이
// 판단했고, 운영 관리 화면에서 고친 글을 모르고 초안으로 덮는 사고가 그 틈에서 난다.
//
// 방향을 정하는 규칙은 하나다 -- **초안 머리말의 updatedAt 이 운영과 언제 맞춰졌는지를 말해 준다.**
// 운영이 그보다 새 값을 들고 있으면 그 사이 관리 화면에서 고쳤다는 뜻이다.
//
//   초안만 있다                          -> 올린다
//   운영에만 있다                        -> 내린다
//   본문이 같다                          -> 아무것도 안 한다
//   본문이 다르고 운영 updatedAt 이 기준과 같음 -> 올린다 (서버가 syncHash도 검사)
//   본문이 다르고 기준 시각도 다름/없음          -> 충돌로 멈춘다
//
// 덮기 전에 **바뀔 글의 운영 사본만** 받아 둔다. 전부 받으면 53편이라 매번 느리고,
// 안 바뀌는 글의 사본은 되돌릴 때 쓸 일이 없다.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const REMOTE = (process.env.JAYWIKI_BLOG_API ?? 'https://portfolio.leneu.cloud/api/bff').replace(/\/+$/, '');
const DRAFT_DIR = process.env.BLOG_DRAFT_DIR ?? 'posts/jay-blog/drafts';
const write = process.argv.includes('--write');

const digest = (s) => createHash('sha1').update(s ?? '').digest('hex');

const run = (cmd, args) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: 'inherit' });
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args[0]} -> ${code}`))));
});

async function get(path) {
  const res = await fetch(`${REMOTE}${path}`, { headers: { 'User-Agent': 'jay-wiki blog-sync' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

/** publish-blog-drafts.mjs 의 parseDraft 와 같은 규칙이다. 다르게 자르면 비교가 어긋난다. */
function parseDraft(file) {
  const raw = readFileSync(file, 'utf8');
  const parts = raw.split('\n---\n');
  if (parts.length < 2) return null;
  const meta = {};
  for (const line of parts[0].split('\n')) {
    const m = /^([a-zA-Z]+):\s*(.+)$/.exec(line.trim());
    if (m) meta[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  if (!meta.slug) return null;
  const body = parts.slice(1).join('\n---\n').trim().replace(/^#\s+.*\n+/, '');
  // 파일을 언제 고쳤는지도 들고 간다. 머리말의 updatedAt 은 「마지막으로 발행된 시각」이라
  // 그 뒤에 이 파일을 손댄 것을 말해 주지 못한다 -- 아래 decide 가 그 둘을 함께 본다.
  return { slug: meta.slug, file, updatedAt: meta.updatedAt ?? null, touchedAt: statSync(file).mtime.toISOString(), body };
}

/**
 * 이 글을 어느 방향으로 옮길지 정한다. 네트워크를 안 타는 순수 판정이라 --self-check 로 고정한다.
 * 잘못 갈리면 글을 덮으므로, 규칙을 손볼 때는 자기검사를 먼저 고친다.
 */
export function decide(draft, prodBody, prodUpdatedAt) {
  if (!prodBody && prodBody !== '') return { dir: 'push', reason: '운영에 없다' };
  if (!draft) return { dir: 'pull', reason: '초안이 없다' };
  if (digest(prodBody) === digest(draft.body)) return { dir: 'same', reason: '본문이 같다' };
  // mtime 은 checkout/copy 로도 바뀐다. 운영과 마지막으로 맞춘 시각이 다르면
  // 파일을 나중에 만졌더라도 어느 쪽도 자동으로 덮지 않는다.
  const synced = draft.updatedAt ? Date.parse(draft.updatedAt) : NaN;
  const served = prodUpdatedAt ? Date.parse(prodUpdatedAt) : NaN;
  return Number.isFinite(synced) && synced === served
    ? { dir: 'push', reason: '운영 수정 시각이 기준과 같다 (서버에서 syncHash도 검사)' }
    : { dir: 'conflict', reason: '본문과 기준 시각이 다르다. 양쪽 사본을 비교해야 한다' };
}

function selfCheck() {
  const eq = (got, want, what) => {
    if (got !== want) throw new Error(`${what}: ${got} 가 나왔는데 ${want} 여야 한다`);
  };
  const d = (body, updatedAt) => ({ body, updatedAt });
  eq(decide(d('본문', '2026-01-01T00:00:00Z'), '본문', '2026-02-01T00:00:00Z').dir, 'same',
    '본문이 같으면 시각과 무관하게 아무것도 안 한다');
  eq(decide(d('고친 본문', '2026-01-01T00:00:00Z'), '본문', '2026-01-01T00:00:00Z').dir, 'push',
    '운영이 안 바뀌었으면 초안을 올린다');
  eq(decide(d('본문', '2026-01-01T00:00:00Z'), '운영에서 고친 본문', '2026-02-01T00:00:00Z').dir, 'conflict',
    '운영이 바뀌었으면 충돌이다');
  eq(decide(d('본문', null), '다른 본문', '2026-02-01T00:00:00Z').dir, 'conflict',
    '초안의 기준이 없으면 충돌이다');
  eq(decide(d('본문', '2026-02-01T00:00:00Z'), '다른 본문', null).dir, 'conflict',
    '운영의 기준이 없으면 충돌이다');
  eq(decide(d('본문', null), null, null).dir, 'push', '운영에 없으면 올린다');
  eq(decide(null, '본문', null).dir, 'pull', '초안이 없으면 내린다');
  // checkout/copy가 파일 시각을 갱신해도 기준이 갈라진 글을 덮지 않는다.
  eq(decide({ body: '고친 본문', updatedAt: '2026-01-01T00:00:00Z', touchedAt: '2026-03-01T00:00:00Z' },
    '본문', '2026-02-01T00:00:00Z').dir, 'conflict',
    '파일을 나중에 만졌어도 충돌을 해소한 것은 아니다');
  eq(decide({ body: '본문', updatedAt: '2026-01-01T00:00:00Z', touchedAt: '2026-01-05T00:00:00Z' },
    '운영에서 고친 본문', '2026-02-01T00:00:00Z').dir, 'conflict',
    '로컬이 더 오래됐더라도 자동으로 덮지 않는다');
  console.log('자기검사 9개 통과');
}

async function main() {
  if (process.argv.includes('--self-check')) return selfCheck();
  const drafts = new Map();
  for (const f of readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.md'))) {
    const d = parseDraft(join(DRAFT_DIR, f));
    if (d) drafts.set(d.slug, d);
  }

  const listed = await get('/blog/posts?size=500');
  const rows = Array.isArray(listed) ? listed : (listed.items ?? listed.content);
  const prod = new Map(rows.map((p) => [p.slug, p]));

  const push = [];   // 로컬 -> 운영
  const pull = [];   // 운영 -> 로컬
  const same = [];
  const conflicts = [];

  for (const slug of new Set([...drafts.keys(), ...prod.keys()])) {
    const d = drafts.get(slug);
    const p = prod.get(slug);
    if (!p) { push.push({ slug, draft: d, reason: '운영에 없다' }); continue; }
    if (!d) { pull.push({ slug, post: p, reason: '초안이 없다' }); continue; }

    // 초안의 updatedAt 은 「운영과 마지막으로 맞춘 시각」이다. 운영이 그보다 새 값을
    // 들고 있으면 그 뒤에 관리 화면에서 고쳤다는 뜻이라, 초안으로 덮으면 그 수정이 사라진다.
    const full = await get(`/blog/posts/${p.id}`);
    const { dir, reason } = decide(d, full.content ?? full.body, full.updatedAt);
    if (dir === 'same') same.push(slug);
    else if (dir === 'conflict') conflicts.push({ slug, reason });
    else if (dir === 'pull') pull.push({ slug, post: { ...p, ...full }, reason });
    else push.push({ slug, draft: d, reason });
  }

  console.log(`같음 ${same.length} / 올릴 것 ${push.length} / 내릴 것 ${pull.length} / 충돌 ${conflicts.length}\n`);
  for (const x of push) console.log(`  ↑ 올린다  ${x.slug}  — ${x.reason}`);
  for (const x of pull) console.log(`  ↓ 내린다  ${x.slug}  — ${x.reason}`);
  for (const x of conflicts) console.log(`  ! 충돌  ${x.slug}  — ${x.reason}`);
  if (conflicts.length) {
    if (write) throw new Error('충돌이 있어 아무 글도 동기화하지 않았다. 양쪽 사본을 먼저 비교한다.');
    return;
  }
  if (push.length + pull.length === 0) { console.log('맞출 것이 없다.'); return; }

  if (!write) {
    console.log('\n실제로 맞추려면 --write 를 붙인다.');
    return;
  }

  // 덮기 전에 운영 사본을 남긴다. 내릴 글은 운영이 정본이라 잃을 것이 없으므로 뺀다.
  const risky = push.filter((x) => prod.has(x.slug));
  if (risky.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = join('.local-backups', `blog-sync-${stamp}`);
    mkdirSync(dir, { recursive: true });
    const saved = [];
    for (const x of risky) saved.push(await get(`/blog/posts/${prod.get(x.slug).id}`));
    writeFileSync(join(dir, 'blog.json'), JSON.stringify(saved, null, 2));
    console.log(`\n덮기 전 운영 사본 ${saved.length}편 -> ${dir}`);
  }

  for (const x of pull) {
    const cat = x.post.categorySlug ?? 'uncategorized';
    console.log(`\n=== 내린다  ${x.slug}`);
    await run('node', ['scripts/pull-blog-post.mjs', String(x.post.id), '--seed-local', '--out', `posts/jay-blog/posts/${cat}`]);
  }

  if (push.length > 0) {
    console.log(`\n=== 올린다  ${push.length}편`);
    await run('node', ['scripts/publish-blog-post.mjs', ...push.map((x) => x.draft.file), '--write']);
  }

  // 내려받기는 로컬 API 로 새로 만드는 경로라 id 가 받은 순서대로 붙는다. 운영과 어긋나면
  // 로컬에서 링크를 눌러도 운영을 못 비춘다. 운영 id 가 정본이다.
  if (pull.length > 0) {
    console.log('\n=== id 를 운영 기준으로 맞춘다');
    await run('node', ['scripts/align-blog-ids.mjs', '--write']).catch((e) => console.warn(`  못 맞췄다: ${e.message}`));
    await run('node', ['scripts/stamp-blog-dates.mjs', '--write']).catch((e) => console.warn(`  날짜를 못 새겼다: ${e.message}`));
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
