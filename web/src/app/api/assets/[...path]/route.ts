import { resolvePublicAsset } from '@/lib/assetPublications';
import { readBoundedBody } from '@/lib/boundedBody';

const ASSET_BASE = process.env.MINIO_ASSET_INTERNAL_BASE ?? 'http://localhost:9000/wiki-assets';

type Context = { readonly params: Promise<{ readonly path: string[] }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const signal = AbortSignal.any([_request.signal, AbortSignal.timeout(15_000)]);
  const { path } = await context.params;
  const asset = resolvePublicAsset(path);
  if (!asset) return new Response(null, { status: 404 });

  const encodedObjectPath = asset.objectPath.split('/').map(encodeURIComponent).join('/');
  const target = `${ASSET_BASE.replace(/\/$/, '')}/${encodedObjectPath}`;
  let upstream: Response;
  let body: ArrayBuffer;
  try {
    upstream = await fetch(target, { next: { revalidate: 3600 }, signal });
    if (!upstream.ok) { await upstream.body?.cancel(); return new Response(null, { status: upstream.status }); }
    body = await readBoundedBody(upstream.body, 32 * 1024 * 1024, signal);
  } catch {
    return new Response(null, { status: 502 });
  }
  return new Response(body, {
    headers: {
      'cache-control': asset.cacheControl,
      ...(asset.contentDisposition ? { 'content-disposition': asset.contentDisposition } : {}),
      'content-type': asset.contentType,
      ...(upstream.headers.get('etag') ? { etag: upstream.headers.get('etag') ?? '' } : {}),
      'x-content-type-options': 'nosniff',
    },
  });
}
