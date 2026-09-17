#!/usr/bin/env node
// 초안 한 편을 그림까지 운영에 올린다. GitHub Actions 도 TOTP 도 안 쓴다.
//
// 왜 이 길인가: 그림을 web/public 에 두면 컨테이너 이미지에 구워져서 배포 한 판이 필요하다.
// 글 한 편에 과금 13분과 대기 20분이 붙는다. 그림을 MinIO 로 보내면 그게 없어지는데,
// 관리자 API 로 올리면 TOTP 를 매번 넣어야 해서 결국 사람이 다시 폴더를 고른다.
// 그래서 배포가 쓰는 문(내부 토큰)을 사람도 쓴다.
//
// 비밀은 이 맥에 안 남긴다. 토큰을 파일로 안 받고 ssh 로 그 자리에서 읽어 프로세스 환경에만 둔다.
//
// 흐름:
//   1. ssh 터널로 운영 Spring 에 붙는다 (kubectl port-forward)
//   2. 초안이 참조하는 web/public 그림을 내부 업로드 문으로 올린다
//   3. 초안 본문의 그림 주소를 /api/wiki-assets/{id} 로 바꾼다
//   4. 그림 파일을 posts/jay-blog/assets/ 로 옮긴다 -- web/public 밖이라 배포를 안 부른다
//   5. publish-blog-drafts.mjs 에 넘겨 본문을 올린다
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { BASE, withProdTunnel } from './lib/prod-tunnel.mjs';

const ASSET_HOME = 'posts/jay-blog/assets';

const DRAFT_DIR = process.env.BLOG_DRAFT_DIR ?? 'posts/jay-blog/drafts';

// 파일을 안 주면 초안 전부다. publish-blog-drafts.mjs 와 같은 규칙이라 두 명령이 다르게 안 움직인다.
const given = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = given.length > 0
  ? given
  : readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.md')).map((f) => join(DRAFT_DIR, f)).sort();
const write = process.argv.includes('--write');
if (files.length === 0) {
  console.error(`${DRAFT_DIR} 에 초안이 없다.`);
  process.exit(1);
}
console.log(`초안 ${files.length}편${given.length === 0 ? ' (전부)' : ''}`);

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

/**
 * 본문의 ![alt](/assets/...) 참조를 모은다. 이미 MinIO 주소인 것은 건드리지 않는다.
 *
 * 코드펜스와 인라인 코드는 걷어내고 찾는다. 글에 예시로 적어 둔 경로를 진짜 그림으로 보면
 * 그걸 올리고 본문을 고쳐 버린다. 대표 이미지 추출기가 같은 이유로 목록에 깨진 썸네일을
 * 띄운 적이 있다(2026-09-02). 판단 기준은 「본문이 실제로 그리는 그림인가」다.
 */
function localImages(body) {
  const prose = body
    .replace(/(^|\n)(```|~~~)[\s\S]*?\n\2[ \t]*(?=\n|$)/g, '\n')
    .replace(/`[^`\n]*`/g, '');
  const found = new Map();
  for (const m of prose.matchAll(/!\[[^\]]*\]\((\/assets\/[^)\s"]+)([^)]*)\)/g)) {
    // 캐시 무효화용 ?v=... 는 본문 참조에는 남기되 로컬 파일명에는 포함하지 않는다.
    // 그대로 join 하면 실제 파일이 있어도 "파일이 없다"고 판단한다.
    found.set(m[1], join('web/public', m[1].split(/[?#]/, 1)[0]));
  }
  return found;
}

/**
 * 이 그림을 참조하는 다른 글을 찾는다. 지금 발행하는 초안 파일 하나만 뺀다.
 *
 * **이 글의 발행 사본(posts/jay-blog/posts/**)은 일부러 안 뺀다.** 사본이 그 경로를 들고 있다는
 * 것은 이미 운영에 그 주소로 나가 있다는 뜻이라, 옮기면 살아 있는 글의 그림이 깨진다.
 * 이미 발행된 글 127곳의 /assets/ 참조를 그대로 두기로 한 결정이 여기서 지켜진다.
 * 발행된 글에 그림을 새로 넣는 경우는 사본에 그 경로가 없으므로 정상적으로 옮겨진다.
 *
 * grep 이 아무것도 못 찾으면 종료 코드 1 로 끝나므로 그것도 「없다」로 본다.
 */
function referencedElsewhere(ref, draftFile) {
  let out = '';
  try {
    out = sh('grep', ['-rl', '--include=*.md', '-F', ref, 'posts/jay-blog']);
  } catch {
    return [];
  }
  return out.split('\n')
    .filter(Boolean)
    .filter((f) => resolve(f) !== resolve(draftFile));
}

async function uploadImage(token, filePath) {
  const bytes = readFileSync(filePath);
  const ext = filePath.split('.').pop().toLowerCase();
  const type = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : ext === 'gif' ? 'image/gif'
    : 'image/jpeg';
  const form = new FormData();
  form.set('file', new Blob([bytes], { type }), basename(filePath));
  const res = await fetch(`${BASE}/internal/content-sync/assets`, {
    method: 'POST',
    headers: { 'x-content-sync-token': token },
    body: form,
  });
  if (!res.ok) throw new Error(`업로드 실패 ${filePath} -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** 로컬 서버가 떠 있으면 같은 초안을 로컬에도 반영한다. 안 떠 있으면 조용히 넘어간다. */
async function syncLocal() {
  const LOCAL = 'http://localhost:8080';
  try {
    const health = await fetch(`${LOCAL}/actuator/health`);
    if (!health.ok) return;
  } catch {
    return;
  }
  console.log('로컬도 같은 본문으로 맞춘다');
  const env = { ...process.env };
  // 로컬에는 내부 토큰 문이 없다. 있으면 그 길로 가려다 404 가 난다.
  delete env.JAYWIKI_INTERNAL_SYNC_TOKEN;
  // 대상이 로컬 자신이다. 자기 발행일을 읽어 자기에게 다시 실어 보낼 이유가 없다.
  delete env.JAYWIKI_LOCAL_API_BASE;
  env.JAYWIKI_API_BASE = `${LOCAL}/api`;
  env.JAYWIKI_ADMIN_PASSWORD = process.env.JAYWIKI_LOCAL_ADMIN_PASSWORD ?? 'admin1234';
  const child = spawn('node', ['scripts/publish-blog-drafts.mjs', ...files, '--write'], { stdio: 'inherit', env });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  if (code !== 0) console.warn('로컬 반영이 실패했다. 운영은 이미 올라갔다.');
}

/**
 * 올리기 전에 상태를 보여 준다. 무엇이 어긋나 있고, 이 명령으로 안 되는 것이 무엇인지.
 * 실패해도 발행을 막지 않는다 -- 운영이 잠깐 안 붙는다고 글을 못 올릴 이유는 없다.
 */
function showState() {
  try {
    const out = execFileSync('node', ['scripts/check-content-sync.mjs', 'blog', '--fast'],
      { encoding: 'utf8' });
    console.log(out.trim());
  } catch (e) {
    // 어긋난 데가 있으면 종료 코드 1 이다. 그것도 보여 줘야 할 상태다.
    if (e.stdout) console.log(String(e.stdout).trim());
    else console.warn('대조를 못 했다:', e.message);
  }

  // 이 명령은 글만 나른다. web/public 이나 코드가 바뀌었으면 그건 배포 몫이다.
  try {
    const changed = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
      .split('\n').map((l) => l.slice(3)).filter(Boolean)
      .filter((f) => f.startsWith('web/') || f.startsWith('spring/') || f.startsWith('infra/'));
    if (changed.length > 0) {
      console.log(`\n코드가 바뀌어 있다 ${changed.length}건 -- 이 명령은 글만 나른다.`);
      for (const f of changed.slice(0, 5)) console.log(`  ${f}`);
      console.log('  화면에 반영하려면 배포가 필요하다: develop -> main 머지');
    }
  } catch {
    // git 이 없거나 저장소가 아니면 넘어간다
  }
  console.log('');
}

async function main() {
  showState();
  await withProdTunnel(async (token) => {
    for (const file of files) {
      const body = readFileSync(file, 'utf8');
      const slug = basename(file, '.md');
      const images = localImages(body);
      let next = body;
      if (images.size > 0) console.log(basename(file));

      for (const [ref, path] of images) {
        if (!existsSync(path)) {
          console.log(`  건너뜀  ${ref} (파일이 없다)`);
          continue;
        }
        // 다른 글이 아직 이 경로를 쓰고 있으면 손대지 않는다. 이미 발행된 글 127곳의
        // /assets/ 참조는 그대로 두기로 했고, 옮기면 그 글의 그림이 다음 배포에서 사라진다.
        // 이 글 자신의 사본은 제외한다.
        const others = referencedElsewhere(ref, file);
        if (others.length > 0) {
          console.log(`  건너뜀  ${ref} -- 다른 글이 쓰고 있다: ${others.join(', ')}`);
          continue;
        }

        if (!write) {
          console.log(`  dry-run  ${ref} 를 올린다`);
          continue;
        }
        const asset = await uploadImage(token, path);
        next = next.split(ref).join(asset.url);
        console.log(`  업로드  ${basename(path)} -> ${asset.url}`);

        // web/public 밖으로 옮긴다. 저장소에는 남고 컨테이너 이미지에는 안 구워진다.
        const home = join(ASSET_HOME, slug);
        mkdirSync(home, { recursive: true });
        const moved = join(home, basename(path));
        // 아직 한 번도 커밋 안 된 파일은 git 이 못 옮긴다. 그때는 그냥 옮기면 되고,
        // 커밋할 때 새 자리에서 처음 추적된다. git 의 오류 메시지는 실패처럼 보여서 감춘다.
        try {
          execFileSync('git', ['mv', path, moved], { stdio: 'pipe' });
        } catch {
          sh('mv', [path, moved]);
        }
        console.log(`  이동    ${path} -> ${moved}`);
      }

      if (write && next !== body) {
        writeFileSync(file, next);
        console.log(`  초안 갱신  ${file}`);
      }
    }

    const publish = spawn('node', ['scripts/publish-blog-drafts.mjs', ...files, ...(write ? ['--write'] : [])], {
      stdio: 'inherit',
      // 로컬 DB 의 발행일·수정일을 실어 보내려면 이 주소가 있어야 한다. 없으면 머리말에
      // publishedAt 이 없는 초안이 «지금»으로 찍혀, 로컬 화면에서 본 날짜와 어긋난다.
      env: {
        ...process.env,
        JAYWIKI_API_BASE: BASE,
        JAYWIKI_INTERNAL_SYNC_TOKEN: token,
        JAYWIKI_LOCAL_API_BASE: process.env.JAYWIKI_LOCAL_API_BASE ?? 'http://localhost:8080/api',
      },
    });
    const code = await new Promise((resolve) => publish.on('exit', resolve));
    if (code !== 0) throw new Error(`발행 스크립트가 ${code} 로 끝났다`);

    // 로컬 DB 는 아직 옛 주소(/assets/...)를 들고 있는데 파일은 web/public 밖으로 옮겨졌다.
    // 그대로 두면 로컬에서 그 글을 다시 열 때 그림이 깨져 보인다 -- 운영은 멀쩡한데 확인하는
    // 자리만 틀린 것이라 더 헷갈린다. 그래서 로컬 서버가 떠 있으면 같은 본문으로 맞춰 둔다.
    if (write) await syncLocal();
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
