#!/usr/bin/env node
/* 가이드북 SVG 그림에서 글자가 겹치거나 그림 밖으로 나간 것을 찾는다.
   눈으로는 잘 안 보이고 인쇄해야 드러나는 종류라, 그림을 더한 뒤 한 번 돌린다.
   실제로 이 검사가 네 건을 잡았다 — 막대 폭을 손으로 정해 오른쪽이 잘린 것 포함.

   playwright 는 web/node_modules 에만 있어서 거기서 끌어다 쓴다.

   두 줄로 나눈 라벨과 배경을 깐 라벨은 겹친 것으로 잡히니(오탐) 눈으로 한 번 본다. */
import { createRequire } from 'node:module';

const { chromium } = createRequire(new URL('../web/', import.meta.url))('playwright');

const url = 'file://' + new URL('../docs/interview/guidebook.html', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto(url);
await page.waitForTimeout(900);

const found = await page.evaluate(() => {
  const out = [];
  const hit = (fig, kind, a, c) => out.push({ fig, kind, a, c });
  for (const fig of document.querySelectorAll('figure')) {
    const svg = fig.querySelector('svg');
    if (!svg) { hit(fig.id, '그림이 안 그려졌다'); continue; }
    const vb = svg.viewBox.baseVal;
    const texts = [...svg.querySelectorAll('text')].map((t) => ({ t: t.textContent, b: t.getBBox() }));

    for (const it of texts) {
      const over = it.b.y + it.b.height > vb.height + 1 || it.b.x + it.b.width > vb.width + 1 || it.b.x < -1;
      if (over) hit(fig.id, '그림 밖으로 넘침', it.t);
    }
    for (let i = 0; i < texts.length; i += 1) {
      for (let j = i + 1; j < texts.length; j += 1) {
        const A = texts[i].b, B = texts[j].b;
        const ox = Math.min(A.x + A.width, B.x + B.width) - Math.max(A.x, B.x);
        const oy = Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y);
        if (ox > 2 && oy > 2) hit(fig.id, '글자끼리 겹침', texts[i].t, texts[j].t);
      }
    }
    const rects = [...svg.querySelectorAll('rect')].map((r) => r.getBBox());
    for (const it of texts) {
      for (const r of rects) {
        const insideY = it.b.y > r.y + 1 && it.b.y + it.b.height < r.y + r.height - 1;
        const crossTop = it.b.y < r.y + 2 && it.b.y + it.b.height > r.y + 2;
        const crossBot = it.b.y < r.y + r.height - 2 && it.b.y + it.b.height > r.y + r.height - 2;
        const overX = Math.min(it.b.x + it.b.width, r.x + r.width) - Math.max(it.b.x, r.x) > 3;
        if (overX && !insideY && (crossTop || crossBot)) hit(fig.id, '상자 테두리를 가로지름', it.t);
      }
    }
  }
  return out;
});
await browser.close();

const byFigure = new Map();
for (const f of found) {
  if (!byFigure.has(f.fig)) byFigure.set(f.fig, []);
  byFigure.get(f.fig).push(f);
}
if (byFigure.size === 0) {
  console.log('그림 검사 통과 — 겹침도 넘침도 없다.');
} else {
  console.log(`살펴볼 그림 ${byFigure.size}개:`);
  for (const [id, list] of byFigure) {
    console.log(`  ${id} (${list.length}건)`);
    for (const f of list.slice(0, 3)) {
      console.log(`    ${f.kind} | ${(f.a ?? '').slice(0, 34)}${f.c ? ' ↔ ' + f.c.slice(0, 28) : ''}`);
    }
  }
}
