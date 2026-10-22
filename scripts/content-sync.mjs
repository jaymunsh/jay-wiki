#!/usr/bin/env node
// 글을 운영과 맞추는 명령 하나. 위키(wiki-sync)와 블로그(blog-sync)를 같은 규칙으로 돈다.
//
//   node scripts/content-sync.mjs                    # 차이만 보여 준다
//   node scripts/content-sync.mjs --write <slug...>  # 그 글만 맞춘다
//   node scripts/content-sync.mjs --write            # 전부 맞춘다 (쓰다 만 블로그 초안도 올라간다)
//
// 규칙: 한쪽만 바뀌었으면 그쪽으로, 둘 다 바뀌었으면 멈춘다. 둘 다 그대로인 글은 본문도 받지 않는다.
// 배포는 글을 쓰지 않는다. 위키·블로그를 운영에 옮기는 길은 이것뿐이다.
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
let failed = false;
for (const script of ['scripts/wiki-sync.mjs', 'scripts/blog-sync.mjs']) {
  const r = spawnSync('node', [script, ...args], { stdio: 'inherit' });
  if (r.status !== 0) failed = true;
  console.log('');
}
process.exit(failed ? 1 : 0);
