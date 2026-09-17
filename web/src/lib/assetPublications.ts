export type PublicAsset = {
  readonly cacheControl: string;
  readonly contentDisposition: string | null;
  readonly contentType: string;
  readonly objectPath: string;
};

const STACK_ASSETS = new Set([
  'cloudflare.svg',
  'github.svg',
  'githubactions.svg',
  'google.svg',
  'googlechrome.svg',
  'fastapi.svg',
  'grafana.svg',
  'kafka.svg',
  'kubernetes.svg',
  'minio.svg',
  'nextjs.svg',
  'opensearch.svg',
  'opentelemetry.svg',
  'postgresql.svg',
  'prometheus.svg',
  'redis.svg',
  'spring.svg',
]);

const PUBLICATION_FILES: ReadonlyMap<string, string> = new Map([
  ['publications/local-llm/2026-07-21-m1-max/raw.json', 'application/json; charset=utf-8'],
  ['publications/local-llm/2026-07-21-m1-max/plan.md', 'text/markdown; charset=utf-8'],
  ['publications/local-llm/2026-07-21-m1-max/result.md', 'text/markdown; charset=utf-8'],
  ['publications/local-llm/2026-07-21-m1-max/SHA256SUMS', 'text/plain; charset=utf-8'],
]);

export function resolvePublicAsset(path: readonly string[]): PublicAsset | null {
  if (path.length === 3 && path[0] === 'portfolio' && path[1] === 'stack' && STACK_ASSETS.has(path[2] ?? '')) {
    return {
      cacheControl: 'public, max-age=3600, stale-while-revalidate=86400',
      contentDisposition: null,
      contentType: 'image/svg+xml',
      objectPath: path.join('/'),
    };
  }

  const objectPath = path.join('/');
  const contentType = PUBLICATION_FILES.get(objectPath);
  if (!contentType) return null;

  return {
    cacheControl: 'public, max-age=31536000, immutable',
    contentDisposition: `inline; filename="${path.at(-1) ?? 'download'}"`,
    contentType,
    objectPath,
  };
}
