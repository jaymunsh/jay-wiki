#!/usr/bin/env node
// 화면을 눈이 아니라 숫자로 잰다. 헤드리스 크롬에 CDP 로 붙어 임의의 식을 돌린다.
//
// 웹 화면은 자동 테스트가 못 잡는다(vitest 가 node 환경이라 DOM 이 없다). 그렇다고
// "봤더니 어긋나 보인다"로 고치면 없는 버그를 만든다 — 실제로 그렇게 세 번 틀렸다.
// 그래서 고치기 전과 후에 이걸로 잰다.
//
//   # 크롬을 먼저 띄운다 (한 번만)
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//     --remote-debugging-port=9334 --user-data-dir=/tmp/jw-measure about:blank &
//
//   node scripts/measure-layout.mjs http://localhost:3000/ --expr "innerWidth"
//   node scripts/measure-layout.mjs http://localhost:3000/ --width 1025 --file scripts/probes/home.js
//   node scripts/measure-layout.mjs http://blog.localhost:3000/25/some-slug --shot /tmp/a.png --sel .prose
//
// 옵션
//   --width N     CSS 폭. Emulation.setDeviceMetricsOverride 로 준다.
//                 크롬의 --window-size 로 모바일을 흉내내면 가짜 폭이 나온다. 반드시 이쪽을 쓴다.
//   --height N    기본 900
//   --dpr N       기본 1. 캡처를 또렷하게 하려면 2
//   --expr <js>   평가할 식. 객체를 돌려주면 JSON 으로 찍는다
//   --file <path> 식을 파일에서 읽는다 (--expr 보다 우선)
//   --wait ms     탐색 후 대기. 기본 3000
//   --bottom      재기 전에 페이지 끝까지 스크롤한다 (lazy 이미지는 스크롤 전에 재면 안 뜬 것처럼 보인다)
//   --shot <path> PNG 로 저장
//   --sel <css>   --shot 과 함께 쓰면 그 요소만 잘라 찍는다
import { writeFile, readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('주소가 없다. 예: node scripts/measure-layout.mjs http://localhost:3000/ --expr "innerWidth"');
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);

const PORT = Number(opt('port', process.env.CDP_PORT ?? 9334));
const width = Number(opt('width', 1440));
const height = Number(opt('height', 900));
const dpr = Number(opt('dpr', 1));
const wait = Number(opt('wait', 3000));
const shotPath = opt('shot', null);
const selector = opt('sel', null);
const exprFile = opt('file', null);
const expression = exprFile ? await readFile(exprFile, 'utf8') : opt('expr', 'innerWidth');

// 크롬 151 부터 GET /json/new 가 거부된다(unsafe HTTP verb). PUT 이어야 한다.
const opened = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).catch(() => null);
if (!opened?.ok) {
  console.error(`크롬에 못 붙었다 (127.0.0.1:${PORT}). --remote-debugging-port=${PORT} 로 띄웠는지 확인한다.`);
  process.exit(2);
}
const { webSocketDebuggerUrl, id } = await opened.json();

const ws = new WebSocket(webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++seq;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expr) => {
  const m = await send('Runtime.evaluate', { returnByValue: true, expression: expr, awaitPromise: true });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? '식 평가 실패');
  return m.result?.result?.value;
};

try {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, wait));
  if (flag('bottom')) {
    await evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await new Promise((r) => setTimeout(r, 1200));
  }

  const value = await evaluate(`(() => { return (${expression}); })()`);
  console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));

  if (shotPath) {
    let clip;
    if (selector) {
      // clip 은 문서 좌표다. getBoundingClientRect 는 뷰포트 좌표라 scrollY 를 더해야 맞는 데를 찍는다.
      clip = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, Math.floor(r.left) - 8), y: Math.max(0, Math.floor(r.top + scrollY) - 8),
                 width: Math.ceil(r.width) + 16, height: Math.ceil(r.height) + 16, scale: 1 };
      })()`);
      if (!clip) throw new Error(`--sel 로 준 '${selector}' 를 못 찾았다`);
    }
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      ...(clip ? { clip } : {}),
    });
    await writeFile(shotPath, Buffer.from(shot.result.data, 'base64'));
    console.error(`저장: ${shotPath}`);
  }
} finally {
  await fetch(`http://127.0.0.1:${PORT}/json/close/${id}`).catch(() => {});
  ws.close();
}
