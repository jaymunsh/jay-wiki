// 범용 BFF 프록시: /api/bff/<무엇이든> → Spring /api/<무엇이든>
// 브라우저(클라이언트 컴포넌트)는 이걸 통해서만 백엔드 호출 → 백엔드 주소/토큰 비노출.
// 예) /api/bff/search?q=redis        → GET  /api/search?q=redis
//     /api/bff/articles/redis        → GET  /api/articles/redis
//     /api/bff/articles (POST)       → POST /api/articles
//     /api/bff/tabs/reorder (POST)   → POST /api/tabs/reorder

import { BACKEND_BASE } from '@/lib/backend';
import { BodyLimitError, readBoundedBody } from '@/lib/boundedBody';
import { hasAllowedOrigin } from '@/lib/requestOrigin';
import { isAdminHost, isManagementApi } from '@/lib/siteHost';

const MAX_REQUEST_BYTES = 11 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

async function proxy(req: Request, path: string[]) {
  const url = new URL(req.url);
  const mutating = !['GET', 'HEAD'].includes(req.method);
  const hostIsAdmin = isAdminHost(req.headers.get('host') ?? url.host);
  const joinedPath = path.join('/');
  if ((isManagementApi(req.method, path) || joinedPath === 'auth/admin-login') && !hostIsAdmin) {
    return Response.json({ detail: '관리 기능은 관리자 사이트에서만 사용할 수 있습니다.' }, { status: 403 });
  }
  if (hostIsAdmin && ['auth/login', 'auth/register'].includes(joinedPath)) {
    return Response.json({ detail: '일반 회원 인증은 공개 사이트에서 사용하세요.' }, { status: 403 });
  }
  if (mutating && !hasAllowedOrigin(req, Boolean(req.headers.get('cookie')))) {
    return Response.json({ detail: '다른 출처의 변경 요청은 허용하지 않습니다.' }, { status: 403 });
  }
  const requestLimit = joinedPath === 'analytics/events' ? 2048 : MAX_REQUEST_BYTES;
  const target = `${BACKEND_BASE}/api/${path.map(encodeURIComponent).join('/')}${url.search}`;

  const headers: Record<string, string> = {
    'content-type': req.headers.get('content-type') ?? 'application/json',
    'x-jaywiki-request': 'server',
    'x-forwarded-host': req.headers.get('host') ?? url.host,
    'x-forwarded-proto': req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', ''),
  };
  for (const name of ['origin', 'sec-fetch-site', 'sec-fetch-mode', 'user-agent', 'dnt', 'sec-gpc']) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }
  // 브라우저의 인증 쿠키(jw_token 등)를 Spring 으로 전달 → 변경 API 인증
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;
  const clientIp = req.headers.get('cf-connecting-ip');
  if (clientIp) headers['cf-connecting-ip'] = clientIp;
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(60_000)]);
  const init: RequestInit = { method: req.method, headers, cache: 'no-store', signal, redirect: 'error' };
  if (mutating) {
    // text() 로 읽으면 이미지 같은 바이너리가 UTF-8 로 재해석되면서 깨진다 --
    // 서버가 "파일 signature 와 선언된 MIME 이 다르다" 로 거절한다. 2026-09-01 에 실제로 그랬다.
    if (Number(req.headers.get('content-length')) > requestLimit) {
      return Response.json({ detail: '요청 본문이 너무 큽니다.' }, { status: 413 });
    }
    try {
      init.body = await readBoundedBody(req.body, requestLimit,
        AbortSignal.any([signal, AbortSignal.timeout(15_000)]));
    } catch (error) {
      return Response.json({ detail: '요청 본문을 받을 수 없습니다.' },
        { status: error instanceof BodyLimitError ? 413 : 408 });
    }
  }

  // 백엔드가 죽었거나 응답하지 않으면 fetch 가 throw 한다.
  // 처리하지 않으면 브라우저에 미가공 500 이 그대로 나가므로 problem+json 으로 감싼다.
  let r: Response;
  let body: ArrayBuffer;
  try {
    r = await fetch(target, init);
    body = await readBoundedBody(r.body, MAX_RESPONSE_BYTES, signal);
  } catch (e) {
    console.error(`[bff] upstream request failed: ${req.method} ${url.pathname}`, e);
    return Response.json(
      {
        type: 'https://jaywiki/errors/upstream-unavailable',
        title: 'Upstream Unavailable',
        status: 502,
        detail: '백엔드 API에 연결하지 못했습니다.',
      },
      { status: 502, headers: { 'content-type': 'application/problem+json' } },
    );
  }

  // 응답도 같은 이유로 바이트 그대로 돌려준다.

  const resHeaders = new Headers({
    'content-type': r.headers.get('content-type') ?? 'application/json',
    'x-cache': r.headers.get('x-cache') ?? 'NONE',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  const searchEngine = r.headers.get('x-search-engine');
  if (searchEngine) resHeaders.set('x-search-engine', searchEngine);
  // 로그인/로그아웃의 Set-Cookie 를 브라우저로 되돌림
  for (const setCookie of r.headers.getSetCookie()) {
    resHeaders.append('set-cookie', setCookie);
  }

  return new Response(body.byteLength > 0 ? body : null, { status: r.status, headers: resHeaders });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: Request, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: Request, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: Request, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
