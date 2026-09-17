#!/usr/bin/env node
// 초안을 실제 렌더러로 돌려 보고, 마크다운 기호가 글자로 새어 나오는 자리를 잡는다.
//
//   node scripts/check-blog-markdown.mjs                 # 초안 전부
//   node scripts/check-blog-markdown.mjs <파일> [<파일>]  # 지정한 것만
//
// 왜 필요한가: 「**「누가 고쳤는가」**로」 처럼 닫는 별표 앞이 따옴표나 괄호이고 뒤에 글자가
// 바로 붙으면 굵게가 안 닫힌다. CommonMark 의 right-flanking 규칙이라 렌더러 버그가 아니고,
// 한국어로 쓰면 「」 를 자주 써서 자주 걸린다. 눈으로는 초안에서 안 보이고 화면에서만 보인다.
//
// 규칙을 흉내 내지 않고 화면이 쓰는 renderer 를 그대로 부른다. 흉내 내면 오탐이 난다.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(join(root, 'web/package.json'));
const { Marked } = require('marked');

const DRAFT_DIR = process.env.BLOG_DRAFT_DIR ?? 'posts/jay-blog/drafts';
const marked = new Marked({ gfm: true, breaks: false });

/**
 * 초안 머리말을 떼고 본문만 준다. publish-blog-drafts.mjs 의 parseDraft 와 같은 규칙이다.
 * 몇 줄을 떼었는지 함께 준다 -- 안 그러면 알려 주는 줄 번호가 머리말 길이만큼 어긋난다.
 */
function bodyOf(text) {
  const parts = text.split('\n---\n');
  if (parts.length < 2) return { body: text, offset: 0 };
  return { body: parts.slice(1).join('\n---\n'), offset: parts[0].split('\n').length + 1 };
}

/** 코드·수식 안의 기호는 원래 글자로 나오는 게 맞다. 검사 대상에서 뺀다. */
function stripCode(html) {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/g, '')
    .replace(/<code[\s\S]*?<\/code>/g, '');
}

// 굵게만 본다. 단일 별표는 곱셈이나 각주로도 쓰여서 규칙으로 가리면 오탐이 는다.
const LEAKS = [{ name: '굵게가 안 닫혔다', re: /\*\*/ }];

const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = targets.length > 0
  ? targets
  : readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.md')).map((f) => join(DRAFT_DIR, f));

const problems = [];
for (const file of files) {
  const { body, offset } = bodyOf(readFileSync(file, 'utf8'));
  // 문단 단위로 돌린다. 굵게가 두 줄에 걸쳐 있는 것은 정상이라, 줄로 자르면 전부 오탐이 된다.
  // 코드펜스는 통째로 건너뛴다 -- 그 안의 별표는 글자로 나오는 게 맞다.
  const lines = body.split('\n');
  let inFence = false;
  let para = [];
  let startLine = 1;
  const flush = () => {
    const text = para.join('\n');
    para = [];
    if (!text.includes('*')) return;
    const html = stripCode(marked.parse(text));
    for (const { name, re } of LEAKS) {
      if (re.test(html)) {
        // 문단 안에서 실제로 새는 줄을 짚어 준다. 한 줄씩 따로 돌려 같은 증상이 나는 줄이
        // 범인이다 -- 문단 첫 줄을 보여 주면 엉뚱한 데를 고치게 된다.
        const bad = text.split('\n').find((l) => l.includes('*') && re.test(stripCode(marked.parse(l))));
        const at = offset + (bad ? startLine + text.split('\n').indexOf(bad) : startLine);
        problems.push(`${relative(root, file)}:${at}  ${name}\n    ${(bad ?? text).trim().slice(0, 110)}`);
        break;
      }
    }
  };
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inFence) flush();
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (line.trim() === '') { flush(); return; }
    if (para.length === 0) startLine = i + 1;
    para.push(line);
  });
  flush();
}

console.log(`초안 ${files.length}편의 본문을 렌더러로 돌려 봤다.`);
if (problems.length === 0) {
  console.log('기호가 새어 나오는 곳이 없다.');
  process.exit(0);
}
for (const p of problems) console.log(`  ${p}`);
console.log(`\n${problems.length}건 새어 나온다. 닫는 별표 앞의 따옴표·괄호를 별표 바깥으로 뺀다 — 「**굵게**」 로.`);
process.exit(1);
