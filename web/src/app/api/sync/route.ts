import { spawn } from 'node:child_process';
import path from 'node:path';
import { BodyLimitError, readBoundedBody } from '@/lib/boundedBody';
import { isLocalManagementRequest } from '@/lib/requestOrigin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * /sync 페이지의 버튼이 부르는 곳. 저장소의 scripts/content-ops.mjs 를 자식 프로세스로 돌리고
 * 출력을 그대로 흘려보낸다. 로직은 그 스크립트 한 곳에만 둔다 — 터미널로 돌릴 때와 같아야 한다.
 *
 * 개발 서버에서만 연다. 운영 빌드에서는 404 다. 로컬 관리 도구라 인증이 없고, 열려 있으면
 * 운영 글을 쓰는 문이 그대로 열린 것이 된다.
 */
const DEV_ONLY = process.env.NODE_ENV === 'development';
let running = false;

// 브라우저가 준 문자열을 인자로 넘기지 않는다. 이 목록에 있는 것만 고른다.
const ACTIONS = new Set([
  'check',
  'sync-wiki',
  'sync-blog',
  'blog-diff',
  'blog-match',
  'publish-wiki',
  'publish-blog',
  'publish-all',
]);

export async function POST(request: Request) {
  if (!DEV_ONLY) return new Response('Not Found', { status: 404 });
  if (!isLocalManagementRequest(request)) return new Response('Forbidden', { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return new Response('JSON required', { status: 415 });
  }
  let payload: unknown;
  try {
    const body = await readBoundedBody(request.body, 4096,
      AbortSignal.any([request.signal, AbortSignal.timeout(5_000)]));
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    return new Response('Invalid request body', {
      status: error instanceof BodyLimitError ? 413 : error instanceof SyntaxError ? 400 : 408,
    });
  }
  if (!payload || typeof payload !== 'object') return new Response('Invalid request', { status: 400 });
  const { action, otp } = payload as { action?: unknown; otp?: unknown };
  if (typeof action !== 'string' || !ACTIONS.has(action)) return new Response('unknown action', { status: 400 });
  if (otp !== undefined && (typeof otp !== 'string' || !/^\d{6}$/.test(otp))) {
    return new Response('Invalid OTP format', { status: 400 });
  }
  if (running) return new Response('다른 동기화가 실행 중입니다.', { status: 409 });
  running = true;

  const root = path.resolve(process.cwd(), '..');
  const child = spawn('node', ['scripts/content-ops.mjs', action], {
    cwd: root,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      // TOTP 는 이 프로세스에만 산다. 로그에도 파일에도 안 남는다.
      ...(otp ? { JAYWIKI_ADMIN_OTP: otp } : {}),
    },
  });

  const stop = () => {
    if (child.exitCode !== null) return;
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch { /* process already exited */ }
  };
  const timeout = setTimeout(stop, 10 * 60_000);
  request.signal.addEventListener('abort', stop, { once: true });
  child.once('close', () => {
    running = false;
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', stop);
  });
  if (request.signal.aborted) stop();

  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let outputBytes = 0;
      const push = (chunk: Buffer) => {
        if (closed) return;
        outputBytes += chunk.byteLength;
        if (outputBytes > 1024 * 1024) { stop(); return; }
        controller.enqueue(encoder.encode(chunk.toString()));
      };
      child.stdout.on('data', push);
      child.stderr.on('data', push);
      child.on('error', (error) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`\n실행하지 못했다: ${error.message}\n`));
        closed = true;
        controller.close();
      });
      child.on('close', (code) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`\n[exit ${code}]\n`));
        closed = true;
        controller.close();
      });
    },
    cancel() {
      closed = true;
      stop();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
