import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.BROWSER_MOCK_PORT ?? 3180);
const nextPort = Number(process.env.BROWSER_NEXT_PORT ?? process.env.PORT ?? 3100);
const slug = process.env.WIKI_SMOKE_SLUG ?? 'browser-smoke-article';

const article = {
  slug,
  parentId: 'verification',
  title: '브라우저 스모크 문서',
  summary: '배포된 HTML과 정적 자산을 확인하는 테스트 문서입니다.',
  kind: 'wiki',
  status: 'published',
  lastReview: '2026-08-21',
  sortOrder: 1,
  viewCount: 0,
  createdAt: '2026-08-21T00:00:00Z',
  updatedAt: '2026-08-21T00:00:00Z',
  version: 1,
  tocEnabled: true,
  body: '이 문서는 공개 위키 경로와 CSS·JavaScript 자산이 함께 로드되는지 확인합니다.\n\n## 확인 항목\n\n- 깊은 링크로 직접 진입\n- 본문 렌더링\n- 정적 자산 응답\n',
};

const tabs = [
  { tabId: 'start', title: '대시보드', sortOrder: 0, articles: [] },
  { tabId: 'verification', title: '운영 검증', sortOrder: 9, articles: [article] },
];

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

const mock = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  if (request.method !== 'GET') return sendJson(response, 404, { error: 'not found' });
  if (url.pathname === '/api/tabs') return sendJson(response, 200, tabs);
  if (url.pathname === `/api/articles/${encodeURIComponent(slug)}`) return sendJson(response, 200, article);
  if (url.pathname === '/api/auth/me') return sendJson(response, 200, { authenticated: false });
  if (url.pathname === '/api/wiki/featured') return sendJson(response, 200, [article]);
  if (url.pathname === '/api/blog/posts') return sendJson(response, 200, []);
  if (url.pathname === '/api/operations') return sendJson(response, 200, { source: 'unavailable' });
  return sendJson(response, 404, { error: 'not found' });
});

await new Promise((resolve) => mock.listen(port, '127.0.0.1', resolve));

const next = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', String(nextPort)], {
  cwd: fileURLToPath(new URL('../web/', import.meta.url)),
  env: { ...process.env, API_INTERNAL_BASE: `http://127.0.0.1:${port}`, PORT: String(nextPort) },
  stdio: 'inherit',
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  next.kill(signal);
  mock.close(() => process.exit(0));
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
next.on('exit', (code, signal) => {
  if (!stopping) {
    mock.close();
    process.exit(code ?? (signal ? 1 : 0));
  }
});
