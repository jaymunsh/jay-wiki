#!/usr/bin/env node
// 위키 산문 문단이 너무 긴지 센다. 스타일 지침이라 배포를 막지 않는다 — 출력만 한다.
//
// 왜 스크립트인가: 한때 「300자 넘는 문단 39개」가 할 일 목록에 있었는데 실제로는 다섯이었다.
// 목록 항목과 들여쓴 이어짐을 문단으로 셌기 때문이다. 눈으로 세면 같은 오산이 또 난다.
//
//   node scripts/check-wiki-paragraphs.mjs [--limit 300]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WIKI = join(ROOT, 'posts', 'jay-wiki');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 300;

/** 목록·표·제목·인용·들여쓴 이어짐은 문단이 아니다. 화면에서 다른 것으로 그려진다. */
function isProse(first) {
  if (/^\s/.test(first)) return false;
  if (/^[|#>]/.test(first)) return false;
  if (/^[-*]/.test(first)) return false;   // 목록과 구분선(---) 둘 다
  if (/^\d+\.\s/.test(first)) return false;
  return true;
}

const files = readdirSync(WIKI, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join(WIKI, d.name)).map((f) => join(WIKI, d.name, f)))
  .filter((f) => f.endsWith('.md'));

const long = [];
for (const file of files) {
  // front matter 를 먼저 뗀다. 안 떼면 그 블록이 통째로 한 문단으로 잡힌다(500자대).
  const body = readFileSync(file, 'utf8')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '');
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim());
    if (!lines.length || !isProse(lines[0])) continue;
    const chars = lines.join(' ').replace(/\s/g, '').length;
    if (chars > LIMIT) long.push({ chars, file: file.slice(WIKI.length + 1), head: lines[0].slice(0, 44) });
  }
}

long.sort((a, b) => b.chars - a.chars);
for (const { chars, file, head } of long) console.log(`${String(chars).padStart(4)}자  ${file}  ${head}`);
console.log(`\n${LIMIT}자 넘는 산문 문단 ${long.length}개 (${files.length}편 기준). 400자 넘는 것 ${long.filter((l) => l.chars > 400).length}개.`);
