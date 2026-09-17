#!/usr/bin/env node
// 로컬 블로그 글 id 를 운영과 같게 맞춘다. 짝은 slug 로 짓는다.
//
//   node scripts/align-blog-ids.mjs            # 무엇을 바꿀지 보여주기만 한다
//   node scripts/align-blog-ids.mjs --write    # 실제로 바꾼다
//
// 왜 필요한가: 블로그 주소가 /<id>/<slug> 라 id 가 다르면 로컬에서 링크를 눌러 봐도
// 운영을 못 비춘다. 실제로 /6/donts3p 가 404 가 아니라 308 로 '다른 글'을 열어 준 적이 있고,
// 로컬 id 가 달라서 그걸 눈으로 못 잡았다.
//
// 왜 자꾸 어긋나나: sync-local-from-prod.sh 가 운영 글을 로컬 API 로 '새로 만든다'.
// id 는 로컬 시퀀스가 받은 순서대로 매긴다. 그래서 이 스크립트를 그 끝에 붙여 둔다.
//
// 운영에는 아무것도 쓰지 않는다. 읽기만 한다.
import { execFileSync } from 'node:child_process';

const REMOTE = process.env.JAYWIKI_BLOG_API ?? 'https://portfolio.leneu.cloud/api/bff';
const LOCAL = process.env.JAYWIKI_LOCAL_API ?? 'http://localhost:8080/api';
const CONTAINER = process.env.JAYWIKI_PG_CONTAINER ?? 'pf-postgres';
const DB_USER = process.env.JAYWIKI_PG_USER ?? 'portfolio';
const DB_NAME = process.env.JAYWIKI_PG_NAME ?? 'portfolio';
const write = process.argv.includes('--write');

// 자식 테이블. FK 가 ON UPDATE NO ACTION 이라 부모만 바꾸면 거부당한다 — 같이 옮긴다.
const CHILDREN = [
  { table: 'tb_blog_post_tag', constraint: 'tb_blog_post_tag_post_id_fkey' },
  { table: 'tb_blog_comment', constraint: 'tb_blog_comment_post_id_fkey' },
];

// 같은 표 안에서 글끼리 잇는 시리즈 링크(V31). 자식 테이블이 아니라 자기 참조라
// 위 목록으로는 안 잡히는데 FK 는 똑같이 걸려 있다. 빠뜨리면 통째로 롤백된다.
const SELF_REFS = [
  { column: 'prev_post_id', constraint: 'fk_blog_post_prev' },
  { column: 'next_post_id', constraint: 'fk_blog_post_next' },
];

async function posts(base) {
  const res = await fetch(`${base}/blog/posts?size=500`, {
    headers: { 'User-Agent': 'jay-wiki align-blog-ids' },
  });
  if (!res.ok) throw new Error(`${base} 가 ${res.status} 를 돌려줬다`);
  const body = await res.json();
  const rows = Array.isArray(body) ? body : (body.items ?? body.content);
  if (!Array.isArray(rows)) throw new Error(`${base} 응답에서 글 목록을 못 찾았다`);
  return rows;
}

const psql = (sql) =>
  execFileSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
    encoding: 'utf8',
  });

const prod = new Map((await posts(REMOTE)).map((p) => [p.slug, p.id]));
const local = await posts(LOCAL);

// 짝 없는 로컬 글(아직 발행 안 한 것)은 운영 최대 id 위로 비켜 둔다. 순서는 지금 id 순.
const maxProd = Math.max(0, ...prod.values());
let spare = maxProd;
const plan = local
  .slice()
  .sort((a, b) => a.id - b.id)
  .map((p) => ({ slug: p.slug, from: p.id, to: prod.get(p.slug) ?? ++spare, paired: prod.has(p.slug) }));

const moves = plan.filter((p) => p.from !== p.to);
console.log(`운영 ${prod.size}편 / 로컬 ${local.length}편 — 옮길 글 ${moves.length}편`);
for (const m of plan) {
  const mark = m.from === m.to ? '  =' : '  →';
  console.log(`${mark} ${String(m.from).padStart(3)} → ${String(m.to).padStart(3)}  ${m.slug}${m.paired ? '' : '  (운영에 없음)'}`);
}

const missing = [...prod.keys()].filter((s) => !local.some((p) => p.slug === s));
if (missing.length) console.log(`\n운영에만 있는 글 ${missing.length}편 — 이 스크립트는 안 만든다: ${missing.join(', ')}`);

if (!moves.length) {
  console.log('\n이미 맞다.');
  process.exit(0);
}
if (!write) {
  console.log('\n--write 를 주면 실제로 바꾼다. 지금은 아무것도 안 했다.');
  process.exit(0);
}

// 옛 id 와 새 id 의 범위가 겹치므로 한 번에 못 옮긴다. 전부 offset 위로 올렸다가 내려놓는다.
const offset = Math.max(...plan.map((p) => Math.max(p.from, p.to))) + 1000;
// 글 id 하나가 흩어져 있는 (표, 컬럼) 전부. 옮길 때 넷을 같이 옮긴다.
const targets = [
  { table: 'tb_blog_post', column: 'id' },
  ...SELF_REFS.map((r) => ({ table: 'tb_blog_post', column: r.column })),
  ...CHILDREN.map((c) => ({ table: c.table, column: 'post_id' })),
];
const shift = (sql) => targets.map(({ table, column }) => sql(table, column)).join('\n');

const sql = `
begin;
${CHILDREN.map((c) => `alter table public.${c.table} drop constraint ${c.constraint};`).join('\n')}
${SELF_REFS.map((r) => `alter table public.tb_blog_post drop constraint ${r.constraint};`).join('\n')}
${shift((t, c) => `update public.${t} set ${c} = ${c} + ${offset};`)}
${plan
  .map((p) => shift((t, c) => `update public.${t} set ${c} = ${p.to} where ${c} = ${p.from + offset};`))
  .join('\n')}
${SELF_REFS.map(
  (r) =>
    `alter table public.tb_blog_post add constraint ${r.constraint} foreign key (${r.column}) references public.tb_blog_post(id) on delete set null;`,
).join('\n')}
${CHILDREN.map(
  (c) =>
    `alter table public.${c.table} add constraint ${c.constraint} foreign key (post_id) references public.tb_blog_post(id) on delete cascade;`,
).join('\n')}
select setval('public.tb_blog_post_id_seq', (select max(id) from public.tb_blog_post));
commit;
`;

// DDL 도 트랜잭션 안이다. 중간에 하나라도 실패하면 통째로 롤백된다.
process.stdout.write(psql(sql));
console.log('\n맞췄다. 확인:');
const after = await posts(LOCAL);
const wrong = after.filter((p) => prod.has(p.slug) && prod.get(p.slug) !== p.id);
console.log(wrong.length ? `  아직 ${wrong.length}편이 다르다: ${wrong.map((p) => p.slug).join(', ')}` : '  운영과 짝지어진 글 전부 id 가 같다.');
process.exit(wrong.length ? 1 : 0);
