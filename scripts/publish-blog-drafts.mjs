#!/usr/bin/env node
/**
 * posts/jay-blog/drafts/*.md 를 운영 블로그에 발행한다.
 *
 * 정본은 블로그 DB다. 이 스크립트는 파일을 정본으로 만들지 않는다 — 초안을 한 번 올리는
 * 도구이고, 올린 뒤 화면에서 고친 내용은 파일로 되돌아오지 않는다. 같은 slug 를 다시 올리면
 * 화면에서 고친 것이 덮인다. 그게 곤란하면 관리자 화면에서 직접 고친다.
 *
 * 인증은 위키 seed 와 같은 경계를 쓴다. 비밀번호는 Keychain 에서 래퍼가 읽어 넘기고,
 * TOTP 는 사람이 그 자리에서 넣는다. 이 파일은 둘 다 저장하지 않는다.
 *
 * 초안 머리말은 첫 `---` 위의 `key: value` 줄이다.
 *   title / slug / category / tags / summary / toc(선택, 기본 true)
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cloudflareAccessHeaders } from './lib/cloudflare-access.mjs';

const API_BASE = process.env.JAYWIKI_API_BASE ?? 'https://admin.leneu.cloud/api/bff';
const USERNAME = process.env.JAYWIKI_ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.JAYWIKI_ADMIN_PASSWORD ?? '';
const OTP = process.env.JAYWIKI_ADMIN_OTP ?? '';
const DRAFT_DIR = process.env.BLOG_DRAFT_DIR ?? 'posts/jay-blog/drafts';
// 클러스터 안에서 도는 판. 관리자 로그인 대신 토큰 하나를 쓰고, 무엇이 바뀌었는지는
// 서버가 판단한다(BlogContentSyncService). 위키 시드가 쓰는 것과 같은 문이다.
const INTERNAL_SYNC_TOKEN = process.env.JAYWIKI_INTERNAL_SYNC_TOKEN?.trim() ?? '';
// /sync 의 「블로그 반영」은 로컬이 정본이다. 그러면 발행일도 로컬 것이 맞다 --
// 로컬 화면에서 본 날짜가 그대로 나가야 한다. 공개 목록에 slug 와 publishedAt 이
// 함께 있어서 인증 없이 읽는다. 안 주면 대상 서버의 기존 발행일을 그대로 둔다.
const LOCAL_API_BASE = process.env.JAYWIKI_LOCAL_API_BASE?.trim() ?? '';
const ACCESS_HEADERS = cloudflareAccessHeaders(API_BASE);

const write = process.argv.includes('--write');
const initializeBaselines = process.argv.includes('--initialize-baselines');
// 확정된 발행일을 초안 머리말에 적어 저장소에 남긴다. 저장소를 못 고치는
// 클러스터 판(ConfigMap 마운트)은 이 플래그를 안 준다.
const stampDates = process.argv.includes('--stamp-dates');
const only = process.argv.filter((a) => !a.startsWith('--')).slice(2);

let cookie = '';

async function api(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'x-jaywiki-request': 'server',
      origin: new URL(API_BASE).origin,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(INTERNAL_SYNC_TOKEN ? { 'x-content-sync-token': INTERNAL_SYNC_TOKEN } : {}),
      ...ACCESS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function login() {
  const res = await fetch(`${API_BASE}/auth/admin-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(API_BASE).origin, ...ACCESS_HEADERS },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, ...(OTP ? { otp: OTP } : {}) }),
  });
  if (!res.ok) throw new Error(`admin login failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('admin login did not return a Set-Cookie header');
  cookie = setCookie.split(';')[0] ?? '';
}

/** 로컬 공개 목록에서 slug -> 글을 모은다. 발행일과 수정일을 여기서 꺼낸다. 못 읽으면 빈 Map 이다. */
async function localPublishedAt() {
  if (!LOCAL_API_BASE) return new Map();
  try {
    const res = await fetch(`${LOCAL_API_BASE}/blog/posts?page=0&size=500`);
    if (!res.ok) throw new Error(`${res.status}`);
    const body = await res.json();
    const items = Array.isArray(body) ? body : (body.content ?? []);
    return new Map(items.filter((p) => p.slug).map((p) => [p.slug, p]));
  } catch (e) {
    console.warn(`  로컬 발행일을 못 읽었다(${e.message}). 대상 서버의 기존 발행일을 그대로 둔다.`);
    return new Map();
  }
}

/** 첫 `---` 위를 머리말로, 아래를 본문으로 가른다. */
function parseDraft(raw, file) {
  const parts = raw.split('\n---\n');
  if (parts.length < 2) throw new Error(`${file}: 머리말과 본문을 가르는 --- 가 없다`);
  const meta = {};
  for (const line of parts[0].split('\n')) {
    const m = /^([a-zA-Z]+):\s*(.+)$/.exec(line.trim());
    // 제목에 콜론이 있으면 YAML 처럼 따옴표로 감싸기 쉽다. 안 벗기면 그 따옴표가
    // 화면 제목에 그대로 찍힌다(2026-08-08 spellcrown 글에서 실제로 나갔다).
    if (m) meta[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  for (const key of ['title', 'slug', 'category', 'summary']) {
    if (!meta[key]) throw new Error(`${file}: 머리말에 ${key} 가 없다`);
  }
  const body = parts.slice(1).join('\n---\n').trim();
  // 본문이 H1 으로 시작하면 화면에 제목이 두 번 나온다. 이관 SQL 과 같은 규칙이다.
  const cleaned = body.replace(/^#\s+.*\n+/, '');
  if (!cleaned) throw new Error(`${file}: 본문이 비었다`);
  // 발행일은 저장소가 정본이다. 배포는 러너에서 돌아 로컬 API 를 못 읽으므로,
  // 머리말에 적힌 값만이 클러스터까지 따라간다.
  for (const key of ['publishedAt', 'updatedAt']) {
    if (meta[key] && Number.isNaN(Date.parse(meta[key]))) {
      throw new Error(`${file}: ${key} 를 날짜로 못 읽는다 — ${meta[key]}`);
    }
  }
  return {
    ...meta,
    tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    // 목차는 기본 켜짐이다. 끄려면 머리말에 toc: false 를 적는다(tb_blog_post.toc_enabled).
    tocEnabled: meta.toc === undefined ? true : !/^(false|off|no)$/i.test(meta.toc),
    publishedAt: meta.publishedAt ?? null,
    updatedAt: meta.updatedAt ?? null,
    file,
    body: cleaned,
  };
}

/**
 * 발행일의 정밀도를 확정한다.
 *
 * 사람은 머리말에 날짜만 적는다 — 「2026-09-04」 나 「2026-09-04T00:00:00Z」 다. 그런데
 * 같은 날 두 편을 올리면 그 값이 정확히 같아지고, 목록이 발행일로 정렬하므로 나중에
 * 올린 글이 아래로 간다(2026-09-04 에 실제로 그랬다). 그래서 **자정이면 시각을 채운다** —
 * 날짜는 사람이 적은 대로 두고, 시·분·초만 지금 것으로 붙인다. 확정한 값은 발행 뒤
 * 머리말에 새기므로, 다시 올려도 그 시각이 그대로 따라간다.
 */
export function resolvePublishedAt(fromDraft, fromLocal, exists = false, now = new Date()) {
  const base = fromDraft ?? fromLocal ?? null;
  const clock = now.toISOString().slice(11);                   // "HH:MM:SS.sssZ"
  if (!base) return `${now.toISOString().slice(0, 10)}T${clock}`;
  const day = base.slice(0, 10);
  // 날짜만 적었거나(2026-09-04) 자정이면(T00:00:00Z) 시각이 없는 것으로 본다.
  const hasClock = /T\d{2}:\d{2}/.test(base) && !/T00:00:00(\.0+)?Z?$/.test(base);
  if (hasClock) return base;
  // 이미 서버에 있는 글이면 자정을 채우지 않는다. 채우면 «지금»이 들어가는데, 클러스터
  // 안에서는 초안이 ConfigMap 이라 stampPublishedAt 의 되새김이 안 남는다. 그래서 초안은
  // 영원히 자정이고 배포할 때마다 시각이 새로 찍힌다 -- 2026-09-04 배포가 옛 글 둘의
  // 발행 시각을 실제로 밀었다. 시각 붙이기는 새 글에만 필요하다.
  if (exists) return base;
  return `${day}T${clock}`;
}

/**
 * 발행일 판정만 검사한다. 네트워크를 안 탄다. 틀리면 조용히 운영 글의 날짜를 바꾸는 자리라,
 * 규칙을 손볼 때는 이 검사를 먼저 고친다.
 */
function selfCheck() {
  const now = new Date('2026-09-04T10:19:22.937Z');
  const eq = (got, want, what) => {
    if (got !== want) throw new Error(`${what}: ${got} 가 나왔는데 ${want} 여야 한다`);
  };
  const at = (draft, local, exists) => resolvePublishedAt(draft, local, exists, now);

  eq(at('2026-08-29T14:03:11Z', null, false), '2026-08-29T14:03:11Z',
    '시각까지 적었으면 그대로 쓴다');
  eq(at('2026-08-29T14:03:11Z', null, true), '2026-08-29T14:03:11Z',
    '이미 있는 글도 시각을 적었으면 그대로 쓴다');
  eq(at('2026-08-29T00:00:00Z', null, false), '2026-08-29T10:19:22.937Z',
    '새 글이 자정이면 그 날짜에 지금 시각을 붙인다');
  eq(at('2026-08-29', null, false), '2026-08-29T10:19:22.937Z',
    '새 글이 날짜만 적었으면 지금 시각을 붙인다');
  // 이 줄이 없던 동안 배포가 옛 글 둘의 발행 시각을 밀었다(2026-09-04). 클러스터에서는
  // 초안이 ConfigMap 이라 되새김이 안 남아서, 배포마다 다시 밀린다.
  eq(at('2026-08-29T00:00:00Z', null, true), '2026-08-29T00:00:00Z',
    '이미 있는 글은 자정이어도 안 건드린다');
  eq(at('2026-08-29', null, true), '2026-08-29',
    '이미 있는 글은 날짜만 적었어도 안 건드린다');
  eq(at(null, '2026-08-29T14:03:11Z', false), '2026-08-29T14:03:11Z',
    '머리말이 없으면 로컬 DB 값을 쓴다');
  eq(at(null, null, false), '2026-09-04T10:19:22.937Z',
    '아무 데도 없으면 지금이다');

  console.log('자기검사 8개 통과');
}

/**
 * 초안 머리말의 publishedAt 을 확정된 값으로 맞춘다. 시각까지 이미 있으면 손대지 않는다.
 * 마지막 머리말 줄 뒤에 붙인다 — 첫 `---` 위가 머리말이라는 규칙만 지키면 순서는 자유다.
 */
async function stampPublishedAt(file, value) {
  const raw = await readFile(file, 'utf8');
  const at = raw.indexOf('\n---\n');
  if (at < 0) return;
  const head = raw.slice(0, at);
  const current = /^publishedAt:\s*(.+)$/m.exec(head)?.[1]?.trim();
  if (current === value) return;
  if (current) {
    // 자정으로 적힌 값만 덮는다. 사람이 시각까지 적었으면 그 뜻을 지킨다.
    if (/T\d{2}:\d{2}/.test(current) && !/T00:00:00(\.0+)?Z?$/.test(current)) return;
    await writeFile(file, raw.replace(/^publishedAt:.*$/m, `publishedAt: ${value}`));
    return;
  }
  // 마지막 내용 줄 뒤에 끼운다. 끝의 빈 줄은 그대로 둔다 — 가이드가 보여주는 형식이다.
  const lines = head.split('\n');
  let last = lines.length - 1;
  while (last >= 0 && lines[last].trim() === '') last -= 1;
  lines.splice(last + 1, 0, `publishedAt: ${value}`);
  await writeFile(file, `${lines.join('\n')}\n${raw.slice(at + 1)}`);
}

/**
 * 클러스터 안에서 도는 길. 배포 잡이 띄운 Job 이 쓴다.
 *
 * 관리 API 를 안 쓴다 -- 로그인이 없으니 목록도 못 읽는다. 대신 초안 전부를 그대로 보내고
 * 서버가 slug 로 찾아 다른 것만 고친다. 공개 API 로 본문을 읽어 비교하는 길은 일부러 안 쓴다.
 * GET /api/blog/posts/{id} 가 조회수를 올려서, 배포마다 가짜 조회가 편마다 하나씩 쌓인다.
 */
async function publishThroughInternalSync(drafts) {
  const categories = await api('/api/blog/categories');
  const flat = [];
  const walk = (list) => list.forEach((c) => { flat.push(c); walk(c.children ?? []); });
  walk(categories);

  // 옛 관리자 경로와 같은 차례로 날짜를 고른다. 머리말 → 로컬 DB → (안 보내면) 운영 기존.
  // 로컬 DB 를 빼면 머리말에 publishedAt 이 없는 초안이 전부 «지금»으로 찍힌다 -- 로컬
  // 화면에서 본 날짜와 운영이 어긋난다(2026-09-03 에 세 편이 그랬다). 클러스터 안에서
  // 돌 때는 로컬 API 가 없어 빈 Map 이고, 그때는 서버가 기존 값을 그대로 쓴다.
  const localDates = await localPublishedAt();
  // 시리즈 연결은 slug 로 적고 id 로 보낸다. id 는 발행 순간에 정해져서 초안에 미리 못 쓴다.
  const idBySlug = await targetIdBySlug();

  let changed = 0;
  for (const d of drafts) {
    const category = flat.find((c) => c.name === d.category);
    if (!category) throw new Error(`카테고리를 찾을 수 없다: ${d.category}`);
    const local = localDates.get(d.slug);
    const publishedAt = !d.publishedAt && !local?.publishedAt && idBySlug.has(d.slug)
      ? null
      : resolvePublishedAt(d.publishedAt, local?.publishedAt, idBySlug.has(d.slug));
    const updatedAt = d.updatedAt ?? local?.updatedAt ?? null;
    const source = d.publishedAt ? '머리말' : local?.publishedAt ? '로컬' : '지금';
    const series = seriesIds(d, idBySlug);
    if (!write) {
      console.log(`dry-run  ${d.slug}  ${d.body.length}자  발행일 ${publishedAt?.slice(0, 19) ?? '운영 기존'} (${source})`
        + (series.note ? `  ${series.note}` : ''));
      continue;
    }
    // coverAssetId 는 안 보낸다. null 로 보내면 대표 이미지가 지워진다.
    // 날짜는 위에서 고른 것을 싣는다. 하나도 못 찾았으면 아예 안 보내는데, 그러면 서버가
    // 기존 값을 쓰므로 기존 글은 날짜가 안 밀리고, 새 글만 지금 시각이 매겨진다 -- 그게
    // 반영이 돈 시각이라 실제 집필일과 어긋난다(2026-08-31 에 9편이 그랬다).
    const result = await api('/internal/content-sync/blog-posts' + (initializeBaselines ? '/preview' : ''), {
      method: 'POST',
      headers: d.syncHash ? { 'x-content-sync-base': d.syncHash } : {},
      body: JSON.stringify({
        slug: d.slug,
        title: d.title,
        summary: d.summary,
        body: d.body,
        categoryId: category.id,
        status: 'published',
        tocEnabled: d.tocEnabled,
        tags: d.tags,
        publishedAt,
        ...(updatedAt ? { updatedAt } : {}),
        ...(series.prevPostId ? { prevPostId: series.prevPostId } : {}),
        ...(series.nextPostId ? { nextPostId: series.nextPostId } : {}),
      }),
    });
    if (initializeBaselines && result.action !== 'unchanged') {
      throw new Error(`${d.slug}: ${result.action}; baseline was not initialized. Reconcile the production copy first.`);
    }
    if (result.syncHash) {
      const raw = await readFile(d.file, 'utf8');
      const divider = raw.indexOf('\n---\n');
      const head = raw.slice(0, divider);
      const stamped = /^syncHash:/m.test(head)
        ? head.replace(/^syncHash:.*$/m, `syncHash: ${result.syncHash}`)
        : `${head.trimEnd()}\nsyncHash: ${result.syncHash}\n`;
      await writeFile(d.file, `${stamped}${raw.slice(divider)}`);
    }
    // 확정한 발행일을 초안에 되새긴다. 저장소가 정본이라, 여기 안 남기면 다음 발행에서
    // 다시 자정으로 돌아가 같은 순서 문제가 난다.
    if (publishedAt) await stampPublishedAt(d.file, publishedAt);
    if (result.id) idBySlug.set(d.slug, result.id);
    if (result.changed) changed += 1;
    console.log(`  ${result.action}  ${result.slug}${result.id ? ` (id ${result.id})` : ''}`
      + (series.note ? `  ${series.note}` : ''));
  }
  console.log(write
    ? `초안 ${drafts.length}편 중 ${changed}편이 바뀌었다`
    : '\n실제로 올리려면 --write 를 붙인다.');
}

/** 대상 서버의 slug → id. 시리즈 연결을 slug 로 적게 하려면 이 표가 있어야 한다. */
async function targetIdBySlug() {
  try {
    const rows = await api('/api/blog/posts?size=500');
    const list = Array.isArray(rows) ? rows : (rows.items ?? rows.content ?? []);
    return new Map(list.filter((p) => p.slug).map((p) => [p.slug, p.id]));
  } catch (e) {
    console.warn(`  글 목록을 못 읽었다(${e.message}). 시리즈 연결은 건너뛴다.`);
    return new Map();
  }
}

/**
 * 머리말의 prevSlug·nextSlug 를 id 로 바꾼다.
 *
 * 서버는 한쪽만 받아도 상대의 반대편을 함께 맞춘다(BlogPostService.applySeriesLinks).
 * 그래서 이어 쓴 글의 머리말에 prevSlug 한 줄만 적으면 양쪽이 연결된다. 아직 발행 안 된
 * slug 를 가리키면 조용히 건너뛴다 — 그 글을 올린 뒤 이 글을 다시 올리면 그때 걸린다.
 */
function seriesIds(draft, idBySlug) {
  const out = { prevPostId: null, nextPostId: null, note: '' };
  const missing = [];
  for (const [key, field] of [['prevSlug', 'prevPostId'], ['nextSlug', 'nextPostId']]) {
    const slug = draft[key];
    if (!slug) continue;
    const id = idBySlug.get(slug);
    if (id) out[field] = id;
    else missing.push(`${key}=${slug}`);
  }
  const linked = [out.prevPostId && `이전 ${out.prevPostId}`, out.nextPostId && `다음 ${out.nextPostId}`].filter(Boolean);
  if (linked.length) out.note = `시리즈 ${linked.join(' · ')}`;
  if (missing.length) out.note += `${out.note ? ' / ' : ''}아직 없는 글: ${missing.join(', ')}`;
  return out;
}

async function main() {
  if (process.argv.includes('--self-check')) return selfCheck();
  if (initializeBaselines && !INTERNAL_SYNC_TOKEN) {
    throw new Error('--initialize-baselines requires internal sync authentication; it never uses admin publication');
  }
  // 로컬은 예외다. 초안을 화면에서 보려면 어딘가에 한 번 올려야 하는데, 그때마다 운영에
  // 올릴 수는 없다. 로컬 관리자에는 2FA 가 없어서 TOTP 를 요구하면 미리보기 길이 막힌다.
  // 판정은 주소로 한다 — pull-blog-post.mjs 의 --seed-local 과 같은 기준이다.
  const local = /^https?:\/\/(?:admin\.)?(?:localhost|127\.0\.0\.1)(?::|\/|$)/.test(API_BASE);
  if (!INTERNAL_SYNC_TOKEN) {
    if (!PASSWORD) throw new Error('JAYWIKI_ADMIN_PASSWORD 가 없다. scripts/publish-blog-drafts.sh 로 실행한다.');
    if (!OTP && !local) throw new Error("TOTP 가 없다. scripts/publish-blog-drafts.sh 로 실행한다.");
  }

  const files = only.length
    ? only
    : (await readdir(DRAFT_DIR)).filter((f) => f.endsWith('.md')).map((f) => join(DRAFT_DIR, f));
  const drafts = [];
  for (const file of files) drafts.push(parseDraft(await readFile(file, 'utf8'), file));

  if (INTERNAL_SYNC_TOKEN) return publishThroughInternalSync(drafts);

  await login();
  const categories = await api('/admin/blog/categories');
  const flat = [];
  const walk = (list) => list.forEach((c) => { flat.push(c); walk(c.children ?? []); });
  walk(categories);
  const existing = await api('/admin/blog/posts');
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  const localDates = await localPublishedAt();

  for (const d of drafts) {
    const category = flat.find((c) => c.name === d.category);
    if (!category) throw new Error(`카테고리를 찾을 수 없다: ${d.category}`);
    const prev = bySlug.get(d.slug);
    const action = prev ? `갱신 (id ${prev.id})` : '신규';
    // 저장소(머리말)가 먼저다. 배포는 로컬 API 를 못 읽으므로 이것만 클러스터까지 간다.
    const source = d.publishedAt ? '머리말'
      : localDates.get(d.slug)?.publishedAt ? '로컬'
      : prev?.publishedAt ? '운영 기존' : null;
    const publishedAt = d.publishedAt ?? localDates.get(d.slug)?.publishedAt ?? prev?.publishedAt ?? null;
    // 수정일도 로컬이 정본이다. 안 보내면 서버가 지금 시각을 박아 '운영에 반영한 시각'이 된다.
    const updatedAt = d.updatedAt ?? localDates.get(d.slug)?.updatedAt ?? null;
    const dateNote = publishedAt
      ? `발행일 ${publishedAt.slice(0, 19)} (${source})`
      : '발행일 새로 매김';
    console.log(`${write ? '발행' : 'dry-run'}  ${d.slug}  ${action}  ${d.body.length}자  태그 ${d.tags.length}개  목차 ${d.tocEnabled ? '켬' : '끔'}  ${dateNote}`);
    if (!write) continue;

    const payload = {
      slug: d.slug,
      title: d.title,
      summary: d.summary,
      body: d.body,
      categoryId: category.id,
      coverAssetId: prev?.coverAssetId ?? null,
      // 시리즈 연결은 초안에 없고 관리자 화면에서만 지정한다. 안 실어 보내면
      // 서버가 null 로 덮고 상대편 링크까지 끊는다(BlogPostService.applySeriesLinks).
      prevPostId: prev?.prevPostId ?? null,
      nextPostId: prev?.nextPostId ?? null,
      status: 'published',
      publishedAt,
      updatedAt,
      tocEnabled: d.tocEnabled,
      tags: d.tags,
    };
    const saved = prev
      ? await api(`/admin/blog/posts/${prev.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await api('/admin/blog/posts', { method: 'POST', body: JSON.stringify(payload) });
    console.log(`  -> /${saved.id}/${saved.slug}`);
    // 저장소에 날짜를 남긴다. 다음 배포는 로컬 API 없이 이 값을 그대로 쓴다.
    if (stampDates && !d.publishedAt && saved.publishedAt && d.file) {
      await stampPublishedAt(d.file, saved.publishedAt);
      console.log(`     머리말에 publishedAt ${saved.publishedAt.slice(0, 19)} 을 적었다`);
    }
  }

  if (!write) console.log('\n실제로 올리려면 --write 를 붙인다.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
