import { BACKEND_BASE } from '@/lib/backend';
import { readBoundedBody } from '@/lib/boundedBody';
import { hostnameOf } from '@/lib/siteHost';

const PUBLIC_FALLBACK = process.env.WIKI_ASSET_PUBLIC_FALLBACK ?? 'https://portfolio.leneu.cloud';

type Context = { readonly params: Promise<{ readonly id: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const signal = AbortSignal.any([_request.signal, AbortSignal.timeout(15_000)]);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_BASE}/api/wiki-assets/${encodeURIComponent(id)}`, {
      cache: 'force-cache',
      signal,
      next: { revalidate: 86400 },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
  // 로컬은 DB 도 MinIO 도 운영과 분리되어 있어서 운영 assetId 를 못 푼다. 초안에 운영 주소가
  // 들어 있는 것이 정상이므로, 로컬 호스트에서만 운영에서 빌려 와 보여 준다. npm start 로
  // 운영 빌드를 미리 볼 때도 같은 조건이다. 발행된 글의 그림은 공개라 인증이 없다.
  const requestHost = hostnameOf(new URL(_request.url).host);
  const localPreview = ['localhost', 'blog.localhost', 'admin.localhost', '127.0.0.1', '::1'].includes(requestHost);
  if (!upstream.ok && localPreview) {
    await upstream.body?.cancel();
    try {
      const borrowed = await fetch(`${PUBLIC_FALLBACK}/api/wiki-assets/${encodeURIComponent(id)}`, {
        cache: 'force-cache',
        signal,
      });
      if (borrowed.ok) upstream = borrowed;
      else await borrowed.body?.cancel();
    } catch {
      // 오프라인이면 그냥 원래 응답을 준다.
    }
  }
  if (!upstream.ok) return new Response(null, { status: upstream.status });

  const headers = new Headers({
    'cache-control': upstream.headers.get('cache-control') ?? 'public, max-age=31536000, immutable',
    'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  const etag = upstream.headers.get('etag');
  if (etag) headers.set('etag', etag);
  try {
    return new Response(await readBoundedBody(upstream.body, 32 * 1024 * 1024, signal), { headers });
  } catch {
    return new Response(null, { status: 502 });
  }
}
