#!/usr/bin/env node
// 로컬과 운영의 글이 같은지 대조한다. 고치지는 않고, 어느 쪽으로 고치면 되는지만 알려준다.
//
//   node scripts/check-content-sync.mjs           # 위키 + 블로그, 본문까지
//   node scripts/check-content-sync.mjs blog      # 하나만
//   node scripts/check-content-sync.mjs --fast    # 위키는 제목·요약만 (글마다 부르지 않는다)
//
// 위키 본문 대조가 기본인 이유: 처음엔 --deep 을 줘야 본문을 봤는데, 바로 그날
// 본문만 바뀐 글 하나(deploy-automation-boundary)를 「같음」으로 보고했다. 제목과 요약이
// 그대로였기 때문이다. 놓치는 검사기는 없는 것보다 나쁘다 -- 맞다고 말해 주니까.
//
// 어긋나면 exit 1.
//
// CI 에 걸지 않는다. 로컬 DB 와 운영을 둘 다 부르므로 CI 에서 돌 수도 없고, 운영을 게이트에
// 물리면 서버가 흔들릴 때마다 배포가 막힌다 -- check-blog-links 를 짤 때 운영 fetch 가
// ETIMEDOUT 으로 두 번 죽는 것을 보고 정한 규칙이다.
//
// 고치는 방향은 사람이 정한다. 자동 반영은 넣지 않는다. 위키의 정본은 로컬 DB 가 아니라
// 시드 파일이고, 블로그 발행에는 TOTP 가 있다.
import { createHash } from 'node:crypto';

const REMOTE = process.env.JAYWIKI_BLOG_API ?? 'https://portfolio.leneu.cloud/api/bff';
const LOCAL = process.env.JAYWIKI_LOCAL_API ?? 'http://localhost:8080/api';
const args = process.argv.slice(2);
const deep = !args.includes('--fast');
const what = args.find((a) => !a.startsWith('--')) ?? 'all';

const get = async (base, path) => {
  const res = await fetch(`${base}${path}`, { headers: { 'User-Agent': 'jay-wiki content-sync check' } });
  if (!res.ok) throw new Error(`${base}${path} 가 ${res.status} 를 돌려줬다`);
  return res.json();
};

// 줄끝과 끝 공백만 고른다. 그 둘은 옮기는 경로가 만드는 차이지 사람이 쓴 차이가 아니다.
const digest = (text) =>
  createHash('sha256')
    .update(String(text ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim())
    .digest('hex')
    .slice(0, 12);

let bad = 0;

function report(label, rows, fixLocalToProd, fixProdToLocal) {
  const onlyLocal = rows.filter((r) => r.state === 'local-only');
  const onlyProd = rows.filter((r) => r.state === 'prod-only');
  const differs = rows.filter((r) => r.state === 'differs');
  const same = rows.length - onlyLocal.length - onlyProd.length - differs.length;

  console.log(`\n=== ${label} — 같음 ${same} / 로컬에만 ${onlyLocal.length} / 운영에만 ${onlyProd.length} / 본문 다름 ${differs.length}`);
  for (const r of onlyLocal) console.log(`  로컬에만  ${r.key}`);
  for (const r of onlyProd) console.log(`  운영에만  ${r.key}`);
  for (const r of differs) console.log(`  다름      ${r.key}${r.newer ? `  (${r.newer} 쪽이 최신)` : ''}`);

  if (onlyLocal.length || differs.length) console.log(`  → 로컬을 운영에 반영: ${fixLocalToProd}`);
  if (onlyProd.length) console.log(`  → 운영을 로컬에 반영: ${fixProdToLocal}`);
  if (onlyLocal.length + onlyProd.length + differs.length) bad += 1;
}

const newerSide = (a, b) => {
  if (!a || !b || a === b) return null;
  return new Date(a) > new Date(b) ? '로컬' : '운영';
};

if (what === 'all' || what === 'wiki') {
  const flatten = (tabs) => tabs.flatMap((t) => t.articles ?? []);
  const [localTabs, prodTabs] = await Promise.all([get(LOCAL, '/tabs'), get(REMOTE, '/tabs')]);
  const local = new Map(flatten(localTabs).map((a) => [a.slug, a]));
  const prod = new Map(flatten(prodTabs).map((a) => [a.slug, a]));

  const rows = [];
  for (const slug of new Set([...local.keys(), ...prod.keys()])) {
    const l = local.get(slug);
    const p = prod.get(slug);
    if (!p) rows.push({ key: slug, state: 'local-only' });
    else if (!l) rows.push({ key: slug, state: 'prod-only' });
    else {
      // 목록 API 는 본문을 안 준다. 기본은 제목·요약만 보고, --deep 이면 본문까지 받아 온다.
      let differs = digest(l.title + l.summary) !== digest(p.title + p.summary);
      if (!differs && deep) {
        const [lb, pb] = await Promise.all([
          get(LOCAL, `/articles/${slug}`),
          get(REMOTE, `/articles/${slug}`),
        ]);
        differs = digest(lb.body) !== digest(pb.body);
      }
      rows.push({ key: slug, state: differs ? 'differs' : 'same', newer: newerSide(l.updatedAt, p.updatedAt) });
    }
  }
  if (!deep) console.log('(--fast: 위키는 제목·요약만 봤다. 본문만 바뀐 글은 못 잡는다)');
  report('위키', rows, 'develop 을 main 에 머지한다 (배포가 시드를 돌린다)', 'scripts/sync-local-from-prod.sh wiki');
}

if (what === 'all' || what === 'blog') {
  const list = async (base) => {
    const body = await get(base, '/blog/posts?size=500');
    const rows = Array.isArray(body) ? body : (body.items ?? body.content);
    return new Map(rows.map((p) => [p.slug, p]));
  };
  const [local, prod] = await Promise.all([list(LOCAL), list(REMOTE)]);

  const rows = [];
  for (const slug of new Set([...local.keys(), ...prod.keys()])) {
    const l = local.get(slug);
    const p = prod.get(slug);
    if (!p) rows.push({ key: slug, state: 'local-only' });
    else if (!l) rows.push({ key: slug, state: 'prod-only' });
    else {
      // 블로그는 17편 남짓이라 본문까지 그냥 다 받아 본다.
      const [lb, pb] = await Promise.all([
        get(LOCAL, `/blog/posts/${l.id}`),
        get(REMOTE, `/blog/posts/${p.id}`),
      ]);
      const differs = digest(lb.content ?? lb.body) !== digest(pb.content ?? pb.body);
      const idNote = l.id === p.id ? '' : ` [id 로컬 ${l.id} ↔ 운영 ${p.id}]`;
      rows.push({
        key: slug + idNote,
        state: differs ? 'differs' : 'same',
        newer: newerSide(lb.updatedAt, pb.updatedAt),
      });
      if (l.id !== p.id) bad += 1;
    }
  }
  const mismatched = [...local].filter(([s, l]) => prod.has(s) && prod.get(s).id !== l.id).length;
  if (mismatched) console.log(`\n블로그 id 가 운영과 다른 글 ${mismatched}편 — node scripts/align-blog-ids.mjs --write`);

  // 발행일은 본문과 따로 어긋난다. 배포는 러너에서 돌아 로컬 API 를 못 읽으므로, 저장소가
  // 날짜를 안 들고 있으면 새 글이 배포가 돈 시각으로 찍힌다(2026-08-25 에 8편이 그랬다).
  const dateGaps = [...local]
    .filter(([slug, l]) => prod.has(slug) && prod.get(slug).publishedAt !== l.publishedAt)
    .map(([slug, l]) => `  발행일    ${slug}  로컬 ${l.publishedAt} ↔ 운영 ${prod.get(slug).publishedAt}`);
  if (dateGaps.length) {
    console.log(`\n발행일이 다른 글 ${dateGaps.length}편`);
    for (const line of dateGaps) console.log(line);
    // 여기서 비교하는 것은 «로컬 DB» 와 운영이다. stamp-blog-dates 는 초안 머리말에만 적으므로
    // 그것만 돌리면 이 줄이 그대로 남는다. 로컬 DB 까지 맞춰야 닫힌다.
    console.log('  → 운영이 맞다면: node scripts/stamp-blog-dates.mjs --write 뒤에');
    console.log('                  node scripts/pull-blog-post.mjs <slug> --seed-local 로 로컬 DB 까지 맞춘다');
    console.log('  → 로컬이 맞다면: node scripts/publish-blog-post.mjs posts/jay-blog/drafts/<slug>.md --write');
    bad += 1;
  }
  report('블로그', rows, 'node scripts/publish-blog-post.mjs --write (그림까지, TOTP 없이)', 'scripts/sync-local-from-prod.sh blog');
}

console.log(bad ? '\n어긋난 데가 있다.' : '\n로컬과 운영이 같다.');
process.exit(bad ? 1 : 0);
