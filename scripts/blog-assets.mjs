#!/usr/bin/env node
// 운영 창고의 그림과 저장소의 원본이 서로 맞는지 보고, 어긋난 것을 되살리거나 치운다.
//
//   node scripts/blog-assets.mjs             # 상태만 본다 (아무것도 안 바꾼다)
//   node scripts/blog-assets.mjs --repair    # 창고에서 사라진 그림을 저장소 원본으로 되올린다
//   node scripts/blog-assets.mjs --prune     # 아무도 참조하지 않는 그림을 지운다
//
// 왜 필요한가: 그림의 정본은 저장소이고 창고는 서빙용 사본이다. 그런데 사본이 사라지면
// 글의 그림만 조용히 깨진다. 원본이 저장소에 있어도 되살리는 절차가 없으면 사본이 하나인 것과
// 다르지 않다. 그래서 「어긋났는지 본다」와 「원본으로 되돌린다」를 같이 둔다.
//
// 지우는 쪽의 안전장치는 서버에 있다. 위키 본문, revision, 블로그 본문, 커버 이미지 중
// 한 곳이라도 참조가 남아 있으면 삭제 API 가 409 로 거부한다.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { BASE, withProdTunnel } from './lib/prod-tunnel.mjs';

const DRAFT_DIR = process.env.BLOG_DRAFT_DIR ?? 'posts/jay-blog/drafts';
const ASSET_HOME = 'posts/jay-blog/assets';

const repair = process.argv.includes('--repair');
const prune = process.argv.includes('--prune');

const drafts = () => readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.md')).map((f) => join(DRAFT_DIR, f));

/** 초안이 참조하는 자산 id 를 모은다. slug 별로 묶어 두면 원본을 찾을 때 쓴다. */
function referencedAssets() {
  const refs = [];
  for (const file of drafts()) {
    const body = readFileSync(file, 'utf8');
    for (const m of body.matchAll(/\/api\/wiki-assets\/([0-9a-f-]{36})/g)) {
      refs.push({ id: m[1], file, slug: basename(file, '.md') });
    }
  }
  return refs;
}

/** 저장소에 있는 원본 파일. 이름은 모르므로 그 글의 자산 폴더에서 하나뿐일 때만 짝을 짓는다. */
function originalFor(slug) {
  try {
    const files = readdirSync(join(ASSET_HOME, slug));
    return files.length === 1 ? join(ASSET_HOME, slug, files[0]) : null;
  } catch {
    return null;
  }
}

async function upload(token, filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const type = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : ext === 'gif' ? 'image/gif'
    : 'image/jpeg';
  const form = new FormData();
  form.set('file', new Blob([readFileSync(filePath)], { type }), basename(filePath));
  const res = await fetch(`${BASE}/internal/content-sync/assets`, {
    method: 'POST',
    headers: { 'x-content-sync-token': token },
    body: form,
  });
  if (!res.ok) throw new Error(`업로드 실패 ${filePath} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  await withProdTunnel(async (token) => {
    const headers = { 'x-content-sync-token': token };

    // 1. 초안이 가리키는 그림이 운영에 실제로 있는가
    const refs = referencedAssets();
    const missing = [];
    for (const ref of refs) {
      // HEAD 는 쓰지 않는다. 보안 설정이 GET 만 공개로 열어 둬서 HEAD 는 403 이 되고,
      // 멀쩡한 그림을 「없음」으로 보고한다. 놓치는 검사기보다 거짓말하는 검사기가 나쁘다.
      const res = await fetch(`${BASE}/api/wiki-assets/${ref.id}`);
      if (!res.ok) missing.push({ ...ref, status: res.status });
    }
    console.log(`초안이 참조하는 그림 ${refs.length}개 중 운영에 없는 것 ${missing.length}개`);

    for (const m of missing) {
      const origin = originalFor(m.slug);
      console.log(`  없음  ${m.id}  ${basename(m.file)}  [${m.status}]  원본 ${origin ?? '못 찾음'}`);
      if (!repair) continue;
      if (!origin) {
        console.warn('  되살릴 원본이 저장소에 없다. 사람이 파일을 찾아야 한다.');
        continue;
      }
      const asset = await upload(token, origin);
      const body = readFileSync(m.file, 'utf8');
      writeFileSync(m.file, body.split(`/api/wiki-assets/${m.id}`).join(asset.url));
      console.log(`  되살림  ${origin} -> ${asset.url}  (초안도 고쳤다)`);
    }
    if (missing.length > 0 && !repair) console.log('  되살리려면 --repair 를 붙인다.');

    // 2. 아무도 참조하지 않는 그림이 창고에 남아 있는가
    const res = await fetch(`${BASE}/internal/content-sync/assets/orphans`, { headers });
    if (!res.ok) throw new Error(`고아 조회 실패: ${res.status} ${await res.text()}`);
    const orphans = await res.json();
    const total = orphans.reduce((sum, a) => sum + a.sizeBytes, 0);
    console.log(`\n참조 없는 그림 ${orphans.length}개, ${total} 바이트`);
    for (const a of orphans) console.log(`  ${a.id}  ${a.originalName}  ${a.sizeBytes} 바이트`);

    if (orphans.length > 0 && !prune) {
      console.log('  지우려면 --prune 을 붙인다.');
      return;
    }
    for (const a of orphans) {
      const del = await fetch(`${BASE}/internal/content-sync/assets/${a.id}`, { method: 'DELETE', headers });
      // 조회와 삭제 사이에 누가 그 그림을 글에 넣었으면 서버가 409 로 막는다. 그게 맞는 동작이다.
      console.log(del.ok ? `  삭제  ${a.id}  ${a.originalName}` : `  건너뜀  ${a.id} -> ${del.status}`);
    }
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
