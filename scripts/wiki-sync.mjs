#!/usr/bin/env node
// 위키 한 방 맞춤. blog-sync 와 같은 규칙을 위키에 쓴다 -- 글마다 로컬과 운영을 대조해
// 한쪽만 바뀌었으면 그쪽으로 맞추고, 둘 다 바뀌었으면 멈춘다.
//
//   node scripts/wiki-sync.mjs             # 무엇을 어느 방향으로 옮길지 보여주기만 한다
//   node scripts/wiki-sync.mjs --write     # 실제로 옮긴다 (운영 쓰기는 ssh 터널, TOTP 없음)
//   node scripts/wiki-sync.mjs --self-check
//
// 왜 필요한가: 예전에는 배포가 release SHA 의 위키 원본 전체를 운영에 썼다. 관리 화면에서
// 고친 글은 다음 배포에 조용히 되돌아갔고, 배포 밖에서 먼저 올린 글도 같았다. 이제 배포는
// 위키를 쓰지 않고, 위키를 운영에 옮기는 길은 이것 하나다.
//
// 「누가 바뀌었나」는 content/wiki/sync-state.json 이 말해 준다. 글마다 마지막으로 맞춘 순간의
// 운영 updatedAt 과 로컬 내용 해시를 적어 둔다.
//   로컬 해시가 기준과 다르면 로컬이 바뀐 것, 운영 updatedAt 이 기준과 다르면 운영이 바뀐 것이다.
//   운영 updatedAt 은 저장할 때만 움직인다(조회수는 따로 센다). 그래서 목록 한 번으로 89편의
//   변화를 알고, 바뀐 글만 본문을 받는다. 아무것도 안 바뀌었으면 요청은 목록 한 번이다.
//
// 탭과 첫 화면 대표 글은 지금처럼 저장소가 정본이다. 다르면 저장소 쪽으로 올린다.
// 지우는 일은 하지 않는다. 운영에만 남은 글은 내려받는다.
// 올리기 전에 덮일 글의 운영 사본을 .local-backups/wiki-sync-<시각>/ 에 받아 둔다. 내린 글은 git 이 되돌린다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BASE as TUNNEL, withProdTunnel } from './lib/prod-tunnel.mjs';

const REMOTE = (process.env.JAYWIKI_BLOG_API ?? 'https://portfolio.leneu.cloud/api/bff').replace(/\/+$/, '');
const ROOT = process.env.WIKI_DIR ?? 'content/wiki';
const MANIFEST = `${ROOT}/manifest.json`;
const STATE = `${ROOT}/sync-state.json`;
const REVIEW_DATE = '2026-07-10'; // seed-portfolio-wiki.mjs 와 같은 기본값
const write = process.argv.includes('--write');
// slug 를 주면 그 글만 본다. --write 가 쓰다 만 초안까지 올리는 일을 막는다.
const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')));

// 시드가 「같다」고 보는 필드(sameArticle)와 같아야 한다. 다르면 시드와 이 명령이 서로 다른 답을 낸다.
const FIELDS = ['parentId', 'title', 'summary', 'body', 'kind', 'tags', 'lastReview', 'tocEnabled', 'sortOrder'];
const normalize = (a) => ({
  parentId: a.parentId, title: a.title, summary: a.summary ?? null, body: a.body, kind: a.kind,
  tags: a.tags ?? null, lastReview: a.lastReview ?? REVIEW_DATE, tocEnabled: a.tocEnabled ?? false, sortOrder: a.sortOrder,
});
export const hashOf = (a) => createHash('sha256').update(JSON.stringify(FIELDS.map((k) => normalize(a)[k]))).digest('hex');

/**
 * 한 글의 방향을 정한다. 네트워크를 타지 않는 순수 판정이다. 잘못 갈리면 글을 덮으므로
 * 규칙을 바꿀 때는 아래 자기검사부터 고친다.
 *   local/prod: { hash, updatedAt } 또는 null. prod.hash 는 본문을 받았을 때만 있다.
 *   base: 마지막으로 맞춘 기준 { hash, updatedAt } 또는 null.
 * 'fetch' 는 「본문을 받아 와야 판단할 수 있다」는 뜻이다. 받은 뒤 prod.hash 를 채워 다시 부른다.
 */
// push 응답은 「+09:00, 나노초」, 목록은 「Z, 마이크로초」로 같은 시각을 다르게 적는다. 문자열이 아니라 시각으로 비교한다.
// ponytail: 밀리초까지만 본다. DB 가 마이크로초로 반올림해 밀리초 경계를 넘으면 기준만 한 번 더 적힌다(본문은 안 덮는다).
export const sameTime = (a, b) => a === b || (a != null && b != null && Date.parse(a) === Date.parse(b));

export function decide(local, prod, base) {
  if (!prod) return { dir: 'push', reason: '운영에 없다' };
  if (!local) return { dir: 'pull', reason: '로컬에 없다' };
  if (!base) {
    if (!prod.hash) return { dir: 'fetch' };
    return prod.hash === local.hash
      ? { dir: 'same', reason: '같다 (기준을 새로 적는다)' }
      : { dir: 'conflict', reason: '기준이 없는데 내용이 다르다. 어느 쪽이 맞는지 사람이 정한다' };
  }
  const localChanged = local.hash !== base.hash;
  const prodChanged = !sameTime(prod.updatedAt, base.updatedAt);
  if (!localChanged && !prodChanged) return { dir: 'same', reason: '둘 다 그대로다' };
  if (localChanged && !prodChanged) return { dir: 'push', reason: '로컬만 바뀌었다' };
  if (!prod.hash) return { dir: 'fetch' };
  if (prod.hash === local.hash) return { dir: 'same', reason: '양쪽이 같은 내용이 됐다 (기준을 새로 적는다)' };
  return localChanged
    ? { dir: 'conflict', reason: '양쪽이 다 바뀌었다' }
    : { dir: 'pull', reason: '운영(관리 화면)만 바뀌었다' };
}

function selfCheck() {
  const eq = (got, want, what) => { if (got !== want) throw new Error(`${what}: ${got} 가 나왔는데 ${want} 여야 한다`); };
  const base = { hash: 'h1', updatedAt: 't1' };
  eq(decide({ hash: 'h1' }, { updatedAt: 't1' }, base).dir, 'same', '둘 다 그대로면 본문을 안 받는다');
  eq(decide({ hash: 'h2' }, { updatedAt: 't1' }, base).dir, 'push', '로컬만 바뀌면 올린다');
  eq(decide({ hash: 'h1' }, { updatedAt: 't2' }, base).dir, 'fetch', '운영이 바뀌면 본문부터 받는다');
  eq(decide({ hash: 'h1' }, { updatedAt: 't2', hash: 'h3' }, base).dir, 'pull', '운영만 바뀌면 내린다');
  eq(decide({ hash: 'h2' }, { updatedAt: 't2', hash: 'h3' }, base).dir, 'conflict', '둘 다 바뀌면 멈춘다');
  eq(decide({ hash: 'h2' }, { updatedAt: 't2', hash: 'h2' }, base).dir, 'same', '둘 다 바뀌었어도 같은 내용이면 맞은 것이다');
  eq(decide({ hash: 'h1' }, { updatedAt: 't2', hash: 'h1' }, base).dir, 'same', '운영이 저장만 다시 했으면 같다');
  eq(decide({ hash: 'h1' }, null, base).dir, 'push', '운영에 없으면 올린다');
  eq(decide(null, { updatedAt: 't1' }, null).dir, 'pull', '로컬에 없으면 내린다');
  eq(decide({ hash: 'h1' }, { updatedAt: 't1' }, null).dir, 'fetch', '기준이 없으면 본문부터 받는다');
  eq(decide({ hash: 'h1' }, { updatedAt: 't1', hash: 'h1' }, null).dir, 'same', '기준이 없어도 같으면 기준을 적는다');
  eq(decide({ hash: 'h1' }, { updatedAt: 't1', hash: 'h9' }, null).dir, 'conflict', '기준이 없고 다르면 멈춘다');
  eq(decide({ hash: 'h1' }, { updatedAt: '2026-10-22T12:40:44.098609Z' }, { hash: 'h1', updatedAt: '2026-10-22T21:40:44.098608704+09:00' }).dir,
    'same', '올린 응답과 목록은 표기만 다르고 같은 시각이다');
  console.log('자기검사 13개 통과');
}

async function get(path) {
  const res = await fetch(`${REMOTE}${path}`, { headers: { 'User-Agent': 'jay-wiki wiki-sync' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback);
const writeJson = (f, v) => writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);

function loadLocal() {
  const manifest = readJson(MANIFEST);
  const articles = new Map();
  for (const meta of manifest.articles) {
    const body = readFileSync(`${ROOT}/articles/${meta.slug}.md`, 'utf8');
    const a = { ...meta, body };
    articles.set(meta.slug, { ...a, hash: hashOf(a) });
  }
  return { manifest, articles };
}

/** 운영에 쓰기 전에 위키 원본이 커밋돼 있는지 본다. 올라간 글이 git 에 없으면 되돌릴 길이 없다. */
function assertCommitted() {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ROOT], { encoding: 'utf8' })
    .split('\n').filter((l) => l && !l.endsWith('sync-state.json'));
  if (dirty.length) throw new Error(`위키 원본에 커밋 안 한 변경이 있다. 커밋한 뒤 올린다:\n${dirty.join('\n')}`);
}

async function main() {
  if (process.argv.includes('--self-check')) return selfCheck();
  const { manifest, articles: local } = loadLocal();
  const state = readJson(STATE, {});

  // 목록 한 번. 탭마다 글의 updatedAt 이 들어 있다.
  const prodTabs = await get('/tabs');
  const prod = new Map(prodTabs.flatMap((t) => t.articles ?? []).map((a) => [a.slug, a]));
  const full = new Map();
  const fetchFull = async (slug) => {
    const a = await get(`/articles/${encodeURIComponent(slug)}`);
    full.set(slug, a);
    return { updatedAt: a.updatedAt, hash: hashOf(a) };
  };

  const plan = { push: [], pull: [], same: [], conflict: [], rebase: [] };
  for (const slug of new Set([...local.keys(), ...prod.keys()])) {
    if (only.size && !only.has(slug)) continue;
    const l = local.get(slug);
    let p = prod.has(slug) ? { updatedAt: prod.get(slug).updatedAt } : null;
    let r = decide(l && { hash: l.hash }, p, state[slug]);
    if (r.dir === 'fetch') { p = await fetchFull(slug); r = decide({ hash: l.hash }, p, state[slug]); }
    if (r.dir === 'same') {
      // 기준이 비었거나 낡았으면 새로 적는다. 다음 실행에서 본문을 다시 받지 않게 하려는 것이다.
      const b = state[slug];
      if (!b || b.hash !== l.hash || !sameTime(b.updatedAt, p.updatedAt)) plan.rebase.push({ slug, hash: l.hash, updatedAt: p.updatedAt });
      else plan.same.push(slug);
    } else plan[r.dir].push({ slug, reason: r.reason });
  }

  // 탭과 대표 글: 저장소가 정본이다.
  const tabPush = manifest.tabs.filter((t) => {
    const cur = prodTabs.find((x) => x.tabId === t.tabId);
    return !cur || cur.title !== t.title || cur.sortOrder !== t.sortOrder;
  });
  const prodFeatured = (await get('/wiki/featured')).map((a) => a.slug);
  const featuredPush = prodFeatured.join(',') !== manifest.featured.join(',');

  console.log(`위키  같음 ${plan.same.length + plan.rebase.length} / 올릴 것 ${plan.push.length} / 내릴 것 ${plan.pull.length} / 충돌 ${plan.conflict.length}`
    + `${tabPush.length ? ` / 탭 ${tabPush.length}` : ''}${featuredPush ? ' / 대표 글' : ''}`);
  for (const x of plan.push) console.log(`  ↑ 올린다  ${x.slug}  — ${x.reason}`);
  for (const x of plan.pull) console.log(`  ↓ 내린다  ${x.slug}  — ${x.reason}`);
  for (const x of plan.conflict) console.log(`  ! 충돌  ${x.slug}  — ${x.reason}`);
  for (const t of tabPush) console.log(`  ↑ 탭  ${t.tabId}`);
  if (featuredPush) console.log(`  ↑ 대표 글  ${manifest.featured.join(' > ')}`);
  if (plan.rebase.length) console.log(`  (기준만 새로 적을 글 ${plan.rebase.length}편 — 내용은 같다)`);

  if (plan.conflict.length) {
    if (write) throw new Error('충돌이 있어 위키를 하나도 옮기지 않았다. 운영 사본과 로컬을 비교해 한쪽으로 맞춘다.');
    return;
  }
  if (!write) {
    if (plan.push.length + plan.pull.length + tabPush.length + plan.rebase.length || featuredPush) console.log('  실제로 맞추려면 --write 를 붙인다.');
    return;
  }

  // 내린다: 운영 글을 md 와 manifest 로 쓴다. 운영 쓰기가 없어 터널이 필요 없다.
  for (const x of plan.pull) {
    const a = full.get(x.slug) ?? await get(`/articles/${encodeURIComponent(x.slug)}`);
    writeFileSync(`${ROOT}/articles/${x.slug}.md`, a.body);
    const meta = { slug: a.slug, ...Object.fromEntries(FIELDS.filter((k) => k !== 'body').map((k) => [k, normalize(a)[k]])) };
    const i = manifest.articles.findIndex((m) => m.slug === x.slug);
    // manifest 에 원래 없던 키(기본값)는 넣지 않는다. diff 를 내용 변화만으로 남기려는 것이다.
    const prev = i >= 0 ? manifest.articles[i] : {};
    for (const k of ['summary', 'tags', 'lastReview', 'tocEnabled']) if (!(k in prev) && meta[k] === normalize({})[k]) delete meta[k];
    if (i >= 0) manifest.articles[i] = { ...prev, ...meta }; else manifest.articles.push(meta);
    // 관리 화면에서 새 탭에 글을 만들었으면 탭도 받아야 manifest 가 깨지지 않는다.
    if (!manifest.tabs.some((t) => t.tabId === a.parentId)) {
      const t = prodTabs.find((x) => x.tabId === a.parentId);
      if (t) manifest.tabs.push({ tabId: t.tabId, title: t.title, sortOrder: t.sortOrder });
    }
    state[x.slug] = { hash: hashOf(a), updatedAt: a.updatedAt };
    console.log(`  내렸다  ${x.slug}`);
  }
  if (plan.pull.length) writeJson(MANIFEST, manifest);

  // 올린다: 터널로 클러스터 안의 내부 문에 쓴다. 토큰은 이 프로세스 메모리에만 있다.
  if (plan.push.length || tabPush.length || featuredPush) {
    assertCommitted();
    // 덮기 전에 덮일 글의 운영 사본만 받아 둔다(blog-sync 와 같은 규칙). 새로 만드는 글은 잃을 것이 없다.
    const risky = plan.push.filter((x) => prod.has(x.slug));
    if (risky.length || tabPush.length || featuredPush) {
      const dir = `.local-backups/wiki-sync-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      mkdirSync(dir, { recursive: true });
      const saved = [];
      for (const x of risky) saved.push(full.get(x.slug) ?? await get(`/articles/${encodeURIComponent(x.slug)}`));
      writeJson(`${dir}/wiki.json`, { articles: saved, tabs: prodTabs.map(({ articles, ...t }) => t), featured: prodFeatured });
      console.log(`  덮기 전 운영 사본 ${saved.length}편 -> ${dir}`);
    }
    const editor = `content-sync:${execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim()}`;
    await withProdTunnel(async (token) => {
      const post = async (method, path, body) => {
        const res = await fetch(`${TUNNEL}/internal/content-sync${path}`, {
          method, headers: { 'content-type': 'application/json', 'x-content-sync-token': token }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
        return res.status === 204 ? null : res.json();
      };
      for (const t of tabPush) await post('POST', '/tabs', { tabId: t.tabId, title: t.title, sortOrder: t.sortOrder });
      for (const x of plan.push) {
        const saved = await post('POST', '/articles', { ...normalize(local.get(x.slug)), slug: x.slug, status: 'published', editor });
        state[x.slug] = { hash: local.get(x.slug).hash, updatedAt: saved.updatedAt };
        console.log(`  올렸다  ${x.slug}`);
      }
      // 글을 다 쓴 뒤에 건다. 새 글을 대표로 걸면 앞에서는 아직 없다.
      if (featuredPush) await post('PUT', '/featured', { slugs: manifest.featured });
    });
  }

  for (const x of plan.rebase) state[x.slug] = { hash: x.hash, updatedAt: x.updatedAt };
  const sorted = Object.fromEntries(Object.keys(state).sort().map((k) => [k, state[k]]));
  writeJson(STATE, sorted);
  console.log(`  기준 → ${STATE} (커밋한다)`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
