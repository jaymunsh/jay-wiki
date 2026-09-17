#!/usr/bin/env node
/* 그림 번호를 <figure id> 의 문서 순서대로 다시 매긴다.
   중간에 그림을 끼우면 뒤 번호가 전부 밀리는데, 손으로 고치면 반드시 어긋난다.
   캡션은 스크립트 안에 있고 그 순서는 문서 순서와 다르므로, id 로 짝지어 찾고
   치환은 반드시 파일 뒤쪽부터 한다 — 문서 순서로 치환하면 앞선 편집이 뒤 오프셋을 밀어 캡션이 깨진다.
   새 그림은 캡션을 '그림 X — …' 로 적어 두면 여기서 번호가 붙는다. */
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/interview/guidebook.html';
const src = readFileSync(path, 'utf8');
const scriptAt = src.indexOf('<script>');

const ids = [...src.slice(0, scriptAt).matchAll(/<figure id="([^"]+)"/g)].map((m) => m[1]);
const edits = [];
for (const [i, id] of ids.entries()) {
  const at = src.indexOf(`'${id}'`, scriptAt);
  if (at < 0) throw new Error(`${id} 를 그리는 코드가 없다`);
  const cap = /그림 (\d+|X) —/.exec(src.slice(at));
  if (!cap) throw new Error(`${id} 의 캡션에 「그림 N —」 이 없다`);
  edits.push({ from: at + cap.index, len: cap[0].length, to: `그림 ${i + 1} —`, id, was: cap[0] });
}

let out = src;
for (const e of [...edits].sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.to + out.slice(e.from + e.len);
writeFileSync(path, out);

const changed = edits.filter((e) => e.was !== e.to);
console.log(`그림 ${ids.length}개 · 번호 바뀐 것 ${changed.length}개`);
for (const e of changed) console.log(`  ${e.id}: ${e.was} → ${e.to}`);
