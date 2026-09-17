#!/usr/bin/env node
// 글만 다루는 작업 다섯을 한 자리에 모은다. 배포(develop → main)와는 별개다 --
// 코드가 안 바뀌고 글만 고쳤을 때, 파이프라인 한 판을 다 돌리지 않고 운영의 글만 갱신하는 길이다.
//
//   node scripts/content-ops.mjs check          # 로컬과 운영의 차이만 본다
//   node scripts/content-ops.mjs sync-wiki      # 시드 → 로컬 DB
//   node scripts/content-ops.mjs sync-blog      # 운영 → 로컬 DB
//   node scripts/content-ops.mjs blog-diff      # 블로그가 어느 쪽으로 갈지만 본다
//   node scripts/content-ops.mjs blog-match     # 블로그를 양방향으로 맞춘다 (TOTP 안 쓴다)
//   node scripts/content-ops.mjs publish-wiki   # 로컬 → 운영 (TOTP)
//   node scripts/content-ops.mjs publish-blog   # 로컬 → 운영 (TOTP)
//   node scripts/content-ops.mjs publish-all    # 위 둘을 차례로 (TOTP 한 번)
//
// TOTP 는 stdin 이나 JAYWIKI_ADMIN_OTP 로 받는다. 비밀번호는 Keychain 에서 실행 순간에만
// 읽는다. 둘 다 파일에 안 남긴다. 이 모듈을 import 하면 /sync 페이지도 같은 함수를 쓴다.
//
// 코드나 이미지 파일을 고쳤다면 이 길로는 안 된다. 정적 파일이 web 컨테이너 이미지 안에
// 있어서 배포가 있어야 화면에 뜬다. requiresDeploy() 가 그것을 먼저 본다.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PROD_PUBLIC_BFF = process.env.JAYWIKI_BLOG_API ?? 'https://portfolio.leneu.cloud/api/bff';
const PROD_ADMIN_BFF = process.env.JAYWIKI_ADMIN_API ?? 'https://admin.leneu.cloud/api/bff';
// 반영은 로컬이 정본이다. 본문뿐 아니라 발행일도 로컬 것을 실어 보낸다.
const LOCAL_API = process.env.JAYWIKI_LOCAL_API ?? 'http://localhost:8080/api';
const KEYCHAIN_SERVICE = process.env.KEYCHAIN_SERVICE ?? 'jay-wiki-production-admin';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';

/** 실행 순간에만 읽는다. 반환값을 어디에도 저장하지 않는다. */
function adminPassword() {
  try {
    return execFileSync(
      'security',
      ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', ADMIN_USERNAME, '-w'],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    throw new Error(
      `Keychain 에 ${KEYCHAIN_SERVICE} / ${ADMIN_USERNAME} 이 없다. scripts/store-production-admin-password.sh 를 먼저 돌린다.`,
    );
  }
}

/** 한 줄씩 onLine 으로 흘려보낸다. 페이지가 진행 상황을 그대로 보여줄 수 있어야 한다. */
function run(command, args, { env = {}, onLine = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        // 없으면 IPv6 를 먼저 잡아 운영 fetch 가 그대로 실패한다(발행 스크립트와 같은 이유).
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --no-network-family-autoselection --dns-result-order=ipv4first`,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buffer = '';
    const feed = (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) onLine(line);
    };
    child.stdout.setEncoding('utf8').on('data', feed);
    child.stderr.setEncoding('utf8').on('data', feed);
    child.on('error', reject);
    child.on('close', (code) => {
      if (buffer) onLine(buffer);
      resolve(code ?? 0);
    });
  });
}

const get = async (path) => {
  const res = await fetch(`${PROD_PUBLIC_BFF}${path}`, { headers: { 'User-Agent': 'jay-wiki content-ops' } });
  if (!res.ok) throw new Error(`${path} 가 ${res.status} 를 돌려줬다`);
  return res.json();
};

/**
 * 운영에 쓰기 전, 지금 운영에 있는 글을 파일로 받아 둔다. 잘못 덮었을 때 되돌릴 자리다.
 * 파이프라인의 DB 백업보다 약하다 -- 삭제는 못 되돌린다. 삭제는 서버 가드(빈 탭만, 한 번에 둘)에 맡긴다.
 * ponytail: 바뀔 것만 고르지 않고 전부 받는다(위키 70 + 블로그 18, 수 초). 느려지면 그때 고른다.
 */
export async function snapshotProduction(what, onLine = () => {}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(ROOT, '.local-backups', stamp);
  let count = 0;
  if (what === 'wiki' || what === 'all') {
    const tabs = await get('/tabs');
    const slugs = tabs.flatMap((tab) => (tab.articles ?? []).map((a) => a.slug));
    const articles = [];
    for (const slug of slugs) articles.push(await get(`/articles/${encodeURIComponent(slug)}`));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'wiki.json'), JSON.stringify({ tabs, articles }, null, 2));
    count += articles.length;
  }
  if (what === 'blog' || what === 'all') {
    const list = await get('/blog/posts?size=500');
    const rows = Array.isArray(list) ? list : (list.items ?? list.content);
    const posts = [];
    for (const row of rows) posts.push(await get(`/blog/posts/${row.id}`));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'blog.json'), JSON.stringify(posts, null, 2));
    count += posts.length;
  }
  onLine(`운영 사본 ${count}편을 .local-backups/${stamp} 에 받아 뒀다`);
  await pullProdBackup(dir, onLine);
  return dir;
}

/**
 * 글 JSON 사본 옆에 DB dump 와 MinIO 사본을 같이 받아 둔다. 여기가 백업이 miniPC 밖으로
 * 나가는 유일한 지점이다 -- 별도 스케줄러를 만들지 않고 "운영에 쓰는 순간"에 얹었다.
 * 설계는 docs/2026-08-16-backup-completeness-design.md.
 *
 * 집 밖이면 LAN ssh 가 안 붙는다. 그때 글 반영까지 막을 이유는 없다 -- 위에서 받은 글 JSON
 * 만으로도 되돌릴 자리는 있으므로, 경고만 남기고 계속한다. 파일이 없다는 것 자체가 기록이다.
 */
async function pullProdBackup(dir, onLine) {
  try {
    const code = await run('scripts/pull-prod-backup.sh', [dir], { onLine });
    if (code !== 0) onLine(`!! DB 백업을 못 받았다(코드 ${code}). 글 사본만 있다`);
  } catch (e) {
    onLine(`!! DB 백업을 못 받았다: ${e.message}. 글 사본만 있다`);
  }
}

/**
 * 글만 올려서는 화면에 안 뜨는 것을 찾는다. 이미지가 그것이다 -- 본문은 API 로 가지만
 * 그림 파일은 web 컨테이너 이미지 안에 있어서 배포가 있어야 뜬다. 글에 새 그림을 넣고
 * 여기만 누르면 본문은 바뀌고 그림 자리는 깨진다.
 *
 * 코드 변경(spring/, web/src/)은 막지 않는다. 아직 배포 안 된 코드가 있는 것은 흔한 상태이고
 * 글 반영을 깨뜨리지 않는다. `origin/main` 이 낡았으면 덜 잡는다 -- 먼저 git fetch 한다.
 */
export function requiresDeploy() {
  const listed = (args) =>
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const changed = new Set([
    ...listed(['diff', '--name-only', 'origin/main...HEAD']),
    ...listed(['status', '--porcelain']).map((line) => line.slice(3)),
  ]);
  return [...changed].filter((f) => f.startsWith('web/public/'));
}

function publishEnv(otp) {
  if (!otp) throw new Error('TOTP 6자리가 필요하다.');
  return {
    JAYWIKI_API_BASE: PROD_ADMIN_BFF,
    JAYWIKI_ADMIN_USERNAME: ADMIN_USERNAME,
    JAYWIKI_ADMIN_PASSWORD: adminPassword(),
    JAYWIKI_ADMIN_OTP: otp,
    JAYWIKI_LOCAL_API_BASE: LOCAL_API,
  };
}

export const OPS = {
  check: {
    label: '차이 확인',
    writesProduction: false,
    // exit 1 이 「어긋난 데가 있다」라서 실패가 아니다. 그래서 코드를 그대로 돌려준다.
    run: (_, onLine) => run('node', ['scripts/check-content-sync.mjs'], { onLine }),
  },
  'sync-wiki': {
    label: '위키 내려받기 (시드 → 로컬)',
    writesProduction: false,
    run: (_, onLine) => run('scripts/sync-local-from-prod.sh', ['wiki'], { onLine }),
  },
  'sync-blog': {
    label: '블로그 내려받기 (운영 → 로컬)',
    writesProduction: false,
    run: (_, onLine) => run('scripts/sync-local-from-prod.sh', ['blog'], { onLine }),
  },
  'publish-wiki': {
    label: '위키 반영 (로컬 → 운영)',
    writesProduction: true,
    run: async (otp, onLine) => {
      const env = publishEnv(otp);
      await snapshotProduction('wiki', onLine);
      return run('node', ['scripts/seed-portfolio-wiki.mjs', '--allow-remote-write'], { env, onLine });
    },
  },
  'blog-diff': {
    label: '블로그 — 무엇이 어느 쪽으로 갈지 본다',
    writesProduction: false,
    run: (_, onLine) => run('node', ['scripts/blog-sync.mjs'], { onLine }),
  },
  'blog-match': {
    label: '블로그 맞추기 (편마다 방향을 정한다)',
    writesProduction: true,
    // 새 경로는 ssh miniPC 로 내부 문을 쓴다. TOTP 도, web/public 그림 가드도 해당이 없다 --
    // 블로그 그림은 MinIO 로 간다. 덮이는 글의 운영 사본은 blog-sync 가 스스로 받아 둔다.
    needsOtp: false,
    run: (_, onLine) => run('node', ['scripts/blog-sync.mjs', '--write'], { onLine }),
  },
  'publish-blog': {
    label: '블로그 반영 (로컬 → 운영)',
    writesProduction: true,
    run: async (otp, onLine) => {
      const env = publishEnv(otp);
      await snapshotProduction('blog', onLine);
      return run('node', ['scripts/publish-blog-drafts.mjs', '--write', '--stamp-dates'], { env, onLine });
    },
  },
  'publish-all': {
    label: '글 전체 반영 (위키 + 블로그)',
    writesProduction: true,
    // TOTP 는 30초마다 바뀌고 같은 값을 두 번 쓰면 서버가 거절할 수 있다. 그래서 한 번의
    // 로그인으로 둘을 끝내지 못하고, 위키가 끝난 뒤 블로그가 같은 값을 다시 쓴다.
    // 실패하면 화면이 다음 코드로 블로그만 다시 하라고 알려 준다.
    run: async (otp, onLine) => {
      const env = publishEnv(otp);
      await snapshotProduction('all', onLine);
      onLine('=== 위키 ===');
      const wiki = await run('node', ['scripts/seed-portfolio-wiki.mjs', '--allow-remote-write'], { env, onLine });
      if (wiki !== 0) return wiki;
      onLine('=== 블로그 ===');
      return run('node', ['scripts/publish-blog-drafts.mjs', '--write', '--stamp-dates'], { env, onLine });
    },
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2];
  const op = OPS[action];
  if (!op) {
    console.error(`쓸 수 있는 것: ${Object.keys(OPS).join(', ')}`);
    process.exit(2);
  }
  let otp = process.env.JAYWIKI_ADMIN_OTP ?? '';
  // TOTP 를 묻는 옛 경로에만 걸리는 가드 둘이다. ssh 로 가는 새 경로(blog-match)는
  // TOTP 도 안 쓰고, 그림이 MinIO 로 가서 web/public 검사에도 해당이 없다.
  const needsOtp = op.needsOtp ?? op.writesProduction;
  if (needsOtp) {
    const blocking = requiresDeploy();
    if (blocking.length && !process.argv.includes('--content-only-anyway')) {
      console.error(`글 말고도 바뀐 것이 있다. 이건 배포가 필요하다:\n  ${blocking.slice(0, 10).join('\n  ')}`);
      process.exit(1);
    }
  }
  if (needsOtp && !otp) {
    // 물어볼 수 있을 때만 묻는다. /sync 가 자식 프로세스로 돌릴 때는 stdin 이 없어서,
    // 여기서 기다리면 브라우저가 영원히 진행 중으로 보인다 -- 무엇이 막혔는지도 안 보인다.
    if (!process.stdin.isTTY) {
      console.error('TOTP 가 없다. 화면의 TOTP 칸에 6자리를 넣거나 JAYWIKI_ADMIN_OTP 로 준다.');
      process.exit(2);
    }
    process.stdout.write('Current Google Authenticator TOTP: ');
    otp = await new Promise((resolve) => {
      process.stdin.setEncoding('utf8').once('data', (d) => resolve(d.trim()));
    });
  }
  const code = await op.run(otp, (line) => console.log(line));
  process.exit(code);
}
