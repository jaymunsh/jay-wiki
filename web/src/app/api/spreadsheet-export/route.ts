import { BACKEND_BASE } from '@/lib/backend';
import { hasAllowedOrigin } from '@/lib/requestOrigin';
import { isAdminHost } from '@/lib/siteHost';

export async function POST(request: Request): Promise<Response> {
  if (!isAdminHost(request.headers.get('host') ?? new URL(request.url).host)) {
    return Response.json({ detail: '관리 기능은 관리자 사이트에서만 사용할 수 있습니다.' }, { status: 403 });
  }
  if (!hasAllowedOrigin(request, true)) return new Response(null, { status: 403 });
  const headers = new Headers();
  headers.set('x-jaywiki-request', 'server');
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_BASE}/api/domain-scenarios/spreadsheet-operations/exports`, {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    });
  } catch {
    return Response.json({ detail: 'Excel 생성 API에 연결하지 못했습니다.' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of ['content-type', 'content-length', 'content-disposition', 'x-export-rows', 'x-export-duration-ms', 'x-export-bytes', 'x-content-type-options']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
